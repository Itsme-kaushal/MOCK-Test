"""Reproducible English-only extraction with PDF answer-color evidence.

Run with the bundled Python (pdfplumber/Pillow), then run ocr.swift on the
generated manifest and run this script with --finalize to create the bank.
"""
from pathlib import Path
from collections import Counter, defaultdict, OrderedDict
import argparse, hashlib, io, json, re
import pdfplumber
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / 'tmp/pdfs'
ASSETS = ROOT / 'public/question-assets'
FILES = [f'tgt_computer_science{i}.pdf' for i in range(1, 6)] + ['pgt_computer_sciecne_female.pdf', 'pgt_computer_sciecne_male.pdf', 'pgt_comp_sci_female_21st_nov_22_s2.pdf', 'pgt_comp_sci_male_21st_nov_22_s2.pdf']
QRE = re.compile(r'^Question Number\s*:\s*(\d+)\s+Question Id\s*:\s*(\d+)')
MARKRE = re.compile(r'Correct Marks\s*:\s*([\d.]+)\s+Wrong Marks\s*:\s*([\d.]+)')
OCR = {}
ASSET_PATHS = set()

def clean(text):
    return text.replace('\x00', '').replace('\u00a0', ' ').strip()

def save_image(image):
    stream = image['stream']
    data = stream.get_data()
    try:
        im = Image.open(io.BytesIO(data)).convert('RGB')
    except Exception:
        mode = 'RGB' if len(data) == image['srcsize'][0] * image['srcsize'][1] * 3 else 'L'
        im = Image.frombytes(mode, image['srcsize'], data).convert('RGB')
    return save_pil(im)

def save_pil(im):
    key = hashlib.sha256(im.tobytes() + str(im.size).encode()).hexdigest()[:24]
    path = ASSETS / (key + '.png')
    if not path.exists(): im.save(path, optimize=True)
    ASSET_PATHS.add(str(path))
    return '/question-assets/' + path.name

def preserve_text_layout(lines, start, end, pages, renders, prompt=False):
    """Render typeset equations rather than flattening superscripts into text."""
    first=lines[start]; boundary=lines[end] if end<len(lines) else None
    last_page=boundary['page'] if boundary else pages[-1].page_number
    urls=[]
    for pno in range(first['page'],last_page+1):
        page=pages[pno-1]
        if pno not in renders:
            renders[pno]=page.to_image(resolution=180).original.convert('RGB')
            if len(renders)>3: renders.popitem(last=False)
        im=renders[pno]
        if prompt:
            lo=first['bottom']+2 if pno==first['page'] else 0
            hi=boundary['top']-2 if boundary and pno==last_page else page.height-8
            x0=first['x0']; x1=page.width-20
        else:
            lo=first['top']-6 if pno==first['page'] else 0
            hi=boundary['top']-4 if boundary and pno==last_page else page.height-8
            body=[c for l in lines[start:end] if l['page']==pno for c in l['chars']]
            # Correct-answer icons and numbered labels are outside this crop.
            content_chars=first['chars'][2:]
            x0=content_chars[0]['x0']-1 if content_chars else first['x0']+27
            x1=max([c['x1'] for c in body]+[x0+1])+3
        if hi<=lo+2: continue
        scale=im.width/page.width
        crop=im.crop((round(x0*scale),round(max(0,lo)*scale),round(x1*scale),round(hi*scale)))
        if not prompt:
            # Option text colors are answer-key metadata; neutralize them.
            pixels=crop.load()
            for y in range(crop.height):
                for x in range(crop.width):
                    r,g,b=pixels[x,y]
                    if (r>g+25 and r>b+25) or (g>r+25 and g>b+25):
                        pixels[x,y]=(min(r,g,b),)*3
        urls.append(save_pil(crop))
    return '\n'.join(f'![Original typeset content]({u})' for u in urls),urls

def region(lines, start, end, pages, left=0, option_markers=None):
    """Interleave native text and image assets without ticks or option labels."""
    if start >= end: return '', [], []
    selected = lines[start:end]
    first, last = selected[0], selected[-1]
    events, image_urls = [], []
    for line in selected:
        text = clean(line['text'])
        if option_markers and line is first: text = re.sub(r'^[1-4]\.\s*', '', text)
        # Metadata has no place in the practice content.
        if text and not re.match(r'^(?:Sub questions|Question Shuffling|Is Section Default|https?://|www\.)', text):
            events.append((line['page'], line['top'], line['x0'], text))
    upper_page = lines[end]['page'] if option_markers and end < len(lines) else last['page']
    for pno in range(first['page'], upper_page + 1):
        page = pages[pno-1]
        lo = (lines[start-1]['bottom'] + 1 if start and lines[start-1]['page']==pno else 0) if pno == first['page'] else 0
        hi = last['bottom'] + 1 if pno == last['page'] else page.height
        # Include image-only space after the last text line up to next boundary.
        if end < len(lines) and lines[end]['page'] == pno: hi = lines[end]['top'] - 1
        elif pno == last['page'] and (end == len(lines) or lines[end]['page'] > pno): hi = page.height
        for im in page.images:
            if im['width'] <= 13 and im['height'] <= 13: continue  # answer tick/cross
            center = (im['top'] + im['bottom']) / 2
            belongs = lo <= center < hi
            if option_markers:
                # PDF option labels align with the image bottom, not its top.
                # Using the center would accidentally assign tall diagrams to
                # the previous option.
                candidates=[k for k in option_markers if lines[k]['page']==pno]
                nearest=min(candidates,key=lambda k:abs(lines[k]['bottom']-im['bottom'])) if candidates else None
                if nearest is not None and abs(lines[nearest]['bottom']-im['bottom']) < 20:
                    belongs=nearest==start
                else:
                    previous=[k for k in option_markers if lines[k]['page'] < pno]
                    belongs=bool(previous) and previous[-1]==start and center<hi
            if belongs and im['x0'] >= left:
                url = save_image(im)
                image_urls.append(url)
                events.append((pno, im['top'], im['x0'], f'![Original question content]({url})'))
    events.sort(key=lambda x: (x[0], round(x[1], 1), x[2]))
    return '\n'.join(e[3] for e in events), image_urls, sorted({e[0] for e in events})

def extract(filename):
    path = Path('/Users/kaushal/Downloads') / filename
    with pdfplumber.open(path) as doc:
        lines = []
        for n, p in enumerate(doc.pages, 1):
            for line in p.extract_text_lines(layout=False):
                line['page'] = n
                line['text'] = clean(line['text'])
                lines.append(line)
        starts, sections, comps, breaks = [], [], [], set()
        for i, line in enumerate(lines):
            text = line['text']
            match = QRE.match(text)
            if match: starts.append((i, int(match[1]), match[2])); breaks.add(i)
            if re.match(r'^Section Id\s*:', text): sections.append((i, lines[i-1]['text']))
            if re.match(r'^Group Number\s*:', text): breaks.add(i-1)
            if re.match(r'^Sub-Section Number\s*:', text): breaks.add(i)
            if re.match(r'^Question Id\s*:', text): breaks.add(i); comps.append(i)
        sorted_breaks = sorted(breaks | {len(lines)})
        contexts = []
        for i in comps:
            next_q = next((q[0] for q in starts if q[0] > i), len(lines))
            header = '\n'.join(l['text'] for l in lines[i:min(i+7, next_q)])
            m = re.search(r'Question Numbers\s*:\s*\((\d+)\s*to\s*(\d+)\)', header)
            if not m: continue
            range_line = next(k for k in range(i,next_q) if 'Question Numbers' in lines[k]['text'])
            end = next((k for k in range(range_line+1,next_q) if lines[k]['text'].startswith('Sub questions')), next_q)
            content, urls, page_ids = region(lines,range_line+1,end,doc.pages)
            contexts.append((i,int(m[1]),int(m[2]),content,urls,page_ids))
        seen = set(); questions = []; excluded = []; renders=OrderedDict()
        for i, qno, qid in starts:
            if qid in seen: continue
            source_section = next((s[1] for s in reversed(sections) if s[0] < i), 'Unknown')
            if 'hindi' in source_section.lower(): seen.add(qid); excluded.append(qno); continue
            end = next(b for b in sorted_breaks if b > i)
            marks = next((k for k in range(i,end) if MARKRE.search(lines[k]['text'])), None)
            opt_header = next((k for k in range(i,end) if re.match(r'^Options\s*:',lines[k]['text'])), None)
            if marks is None or opt_header is None: raise ValueError((filename,qno,'missing metadata'))
            # A few PDFs put the Hindi variant before the English variant.
            if any(re.search(r'[\u0900-\u097f]', l['text']) for l in lines[marks+1:end]): continue
            seen.add(qid)
            mm = MARKRE.search(lines[marks]['text'])
            opt_starts = [k for k in range(opt_header+1,end) if re.match(r'^[1-4]\.\s*',lines[k]['text'])]
            if len(opt_starts)!=4: raise ValueError((filename,qno,'options',len(opt_starts)))
            text, urls, source_pages = region(lines,marks+1,opt_header,doc.pages)
            # Images may start in otherwise empty prompt space, before Options.
            if not text:
                text, urls, source_pages = region(lines,marks,opt_header,doc.pages)
                text = '\n'.join(t for t in text.split('\n') if not t.startswith('Correct Marks'))
            matching_context = next((c for c in reversed(contexts) if c[0] < i and c[1] <= qno <= c[2]), None)
            native_prompt=text
            unsafe_prompt=any(c['size']<11.5 or c['text']=='\x00' for l in lines[marks+1:opt_header] for c in l['chars'])
            if unsafe_prompt and '22_s2' not in filename:
                text, layout_urls=preserve_text_layout(lines,marks,opt_header,doc.pages,renders,prompt=True)
                urls += layout_urls
            if matching_context:
                text = '**Read the passage:**\n' + matching_context[3] + '\n\n**Question:**\n' + text
                urls += matching_context[4]; source_pages += matching_context[5]
            options = []; correct = []; native_options=[]
            # Superscripts can be sorted before their option label. If any
            # option uses them, preserve the layout of every text-only option.
            unsafe_options=any(c['size']<11.5 or c['text']=='\x00' for l in lines[opt_header+1:end] for c in l['chars'])
            for j, k in enumerate(opt_starts):
                stop = opt_starts[j+1] if j<3 else end
                content, option_urls, option_pages = region(lines,k,stop,doc.pages,left=lines[k]['x0']+10,option_markers=opt_starts)
                content = re.sub(r'^[1-4]\.\s*','',content)
                native_options.append(content)
                if unsafe_options and not option_urls and '22_s2' not in filename:
                    content,option_urls=preserve_text_layout(lines,k,stop,doc.pages,renders)
                options.append(content.strip())
                urls += option_urls; source_pages += option_pages
                green = [c for c in lines[k]['chars'] if isinstance(c['non_stroking_color'],tuple) and len(c['non_stroking_color']) == 3 and c['non_stroking_color'][1] > .4 and c['non_stroking_color'][0] < .1]
                if green: correct.append(j)
            # All discipline subdivisions are one CS section for section practice.
            sl=source_section.lower()
            section = 'Teaching Aptitude' if 'teaching' in sl else 'Computer Science' if 'discipline' in sl or 'subject' in sl or 'computer' in sl else 'Quantitative Aptitude' if 'arith' in sl or 'numerical' in sl or 'quant' in sl else 'Reasoning & Aptitude' if 'ability' in sl or 'reasoning' in sl else 'English' if 'english' in sl else 'General Awareness'
            withdrawn=bool(re.search(r'ignored for\s+all\s+candidates',native_prompt))
            questions.append(dict(qNo=qno,text=text or 'See the original question below.',options=options,correctIndex=correct[0] if len(correct)==1 and not withdrawn else None,marks=float(mm[1]),negativeMarks=float(mm[2]),sourceFile=filename,sourceQuestionId=qid,sourcePages=sorted(set(source_pages + [lines[marks]['page']])),sourceSection=source_section,section=section,imageAssets=urls,passage=bool(matching_context),answerStatus='withdrawn' if withdrawn else 'provided' if len(correct)==1 else 'missing',nativeSearchText=native_prompt+'\n'+'\n'.join(native_options)))
        print(filename,len(questions),'English questions;',len(excluded),'Hindi excluded',flush=True)
        # Release parsed pages: the corpus has over 2,000 pages.
        creation = re.search(r'Creation Date\s*:\s*(\d{4}-\d\d-\d\d)', '\n'.join(l['text'] for l in lines[:100]))
        return dict(sourceFile=filename,sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),sourcePageCount=len(doc.pages),sourceDurationMin=180 if filename.startswith('pgt') else 120,date=creation[1] if creation else '2022-11-21',dateKind='document creation date' if creation else 'exam date from filename',excludedHindiQuestionNumbers=excluded,questions=questions)

def classify(q):
    """Transparent keyword taxonomy; ambiguous items retain a broad chapter."""
    s=q['section']; text=search_text(q).lower()
    rules={
      'English': [('Reading Comprehension',r'read the passage'),('Vocabulary',r'synonym|antonym|one word|idiom|spelling|spelt|meaning|substitut'),('Grammar',r'voice|narration|speech|sentence|blank|preposition|tense|article|error')],
      'Reasoning & Aptitude': [('Verbal Reasoning',r'analogy|analogous|series|sequence|alphabet|coding|coded|letter|dictionary|odd|different|arrange'),('Logical Reasoning',r'syllog|conclusion|statement|assumption|blood|brother|sister|father|mother|relation|direction|north|south|east|west|rank|position|seating|placed'),('Non-verbal Reasoning',r'figure|mirror|image|fold|dice|cube|pattern')],
      'Quantitative Aptitude': [('Arithmetic',r'percent|profit|loss|discount|interest|ratio|proportion|average|mean|age|salary|income|work|pipe|speed|distance|train|boat|stream'),('Number System',r'number|divisib|hcf|lcm|remainder|fraction|decimal|simplif|square root'),('Algebra',r'equation|polynomial|algebra|expression'),('Geometry & Mensuration',r'area|volume|triangle|circle|radius|perimeter|cylinder|sphere|cone|rectangle|angle|trigon')],
      'General Awareness': [('Indian Polity',r'constitution|parliament|president|governor|fundamental|amendment|article|supreme court|lok sabha'),('History & Culture',r'king|emperor|dynasty|battle|gandhi|independence|music|vadya|dance|temple|ancient|mughal'),('Geography',r'river|mountain|soil|climate|ocean|latitude|longitude|state|geograph'),('Economics',r'econom|money|bank|reserve|inflation|demand|supply|gdp|budget'),('General Science',r'chemical|acid|base|organism|virus|fung|bacter|refraction|wave|force|energy|electric|cell|vitamin|wheat')],
      'Teaching Aptitude': [('Educational Psychology',r'psycholog|cognit|development|intelligence|motivation|learning|piaget'),('Teaching & Assessment',r'teaching|teacher|assessment|evaluation|curriculum|method|classroom'),('Inclusive Education',r'inclusi|disabil|special needs|diversity')],
      'Computer Science': [('Databases',r'database|sql|dbms|normaliz|relational|relation|transaction|primary key|foreign key|functional depend'),('Computer Networks',r'network|protocol|router|tcp|udp|ip address|osi|ethernet|subnet|bandwidth|topology|http|ftp|smtp|ipv[46]'),('Operating Systems',r'operating system|process|thread|deadlock|schedul|paging|virtual memory|semaphore|linux|unix'),('Data Structures & Algorithms',r'algorithm|complexity|sorting|search|binary tree|linked list|stack|queue|heap|graph|recurs|hash|data structure'),('Computer Architecture',r'cpu|processor|register|cache|instruction|addressing|microprocessor|memory|bus|pipeline|interrupt|ram|rom'),('Digital Logic',r'boolean|logic gate|flip.flop|multiplexer|binary|octal|hexadecimal|decimal|number system|logic circuit|karnaugh|counter|adder'),('Programming',r'program|java|python|c\+\+|language|pointer|class|object|inheritance|polymorph|function|variable|compiler|syntax|array|operator'),('Software Engineering',r'software|testing|sdlc|waterfall|agile|requirement|uml|coupling|cohesion'),('Web Technologies',r'html|css|javascript|browser|xml|web|internet|url'),('Theory of Computation',r'automata|turing|grammar|regular expression|finite|context.free'),('Artificial Intelligence',r'artificial|neural|machine learning|expert system|fuzzy|intelligence'),('Security',r'security|encrypt|cryptograph|firewall|malware|password|authentication'),('Computer Fundamentals',r'computer|input|output|device|printer|keyboard|spreadsheet|excel|word|powerpoint|file|storage|information')]
    }
    chapter=next((name for name,pattern in rules.get(s,[]) if re.search(pattern,text)), s + ' Essentials')
    topics=[('Synonyms',r'synonym'),('Antonyms',r'antonym'),('Idioms & Phrases',r'idiom'),('Spelling',r'spelling|spelt'),('Sentence Correction',r'error|sentence'),('Coding & Decoding',r'coding|coded'),('Blood Relations',r'brother|sister|father|mother|blood'),('Direction Sense',r'north|south|east|west|direction'),('Ranking & Arrangement',r'rank|position|seating|placed'),('Number & Letter Series',r'series|sequence'),('Percentages',r'percent'),('Profit, Loss & Discount',r'profit|loss|discount'),('Simple & Compound Interest',r'interest'),('Time & Work',r'work|pipe'),('Speed, Time & Distance',r'speed|distance|train|boat'),('Ratio & Proportion',r'ratio|proportion'),('Averages',r'average|mean'),('SQL Queries',r'\bsql\b|select.*from'),('Database Normalization',r'normaliz|functional depend'),('Network Models & Protocols',r'protocol|osi|tcp|udp'),('Scheduling & Deadlocks',r'schedul|deadlock'),('Trees & Graphs',r'tree|graph'),('Sorting & Searching',r'sorting|search'),('Logic Gates & Boolean Algebra',r'boolean|logic gate'),('Object-Oriented Programming',r'inheritance|polymorph|class|object')]
    if s=='English' and q['passage']: return chapter,'Reading Comprehension'
    relevant = topics[:5] if s=='English' else topics[5:10] if s=='Reasoning & Aptitude' else topics[10:17] if s=='Quantitative Aptitude' else topics[17:] if s=='Computer Science' else []
    if s=='Computer Science':
        chapter_topics={
            'Databases': {'SQL Queries','Database Normalization'},
            'Computer Networks': {'Network Models & Protocols'},
            'Operating Systems': {'Scheduling & Deadlocks'},
            'Data Structures & Algorithms': {'Trees & Graphs','Sorting & Searching'},
            'Digital Logic': {'Logic Gates & Boolean Algebra'},
            'Programming': {'Object-Oriented Programming'},
        }
        relevant=[rule for rule in relevant if rule[0] in chapter_topics.get(chapter,set())]
    topic=next((name for name,p in relevant if re.search(p,text)),chapter)
    return chapter,topic

def search_text(q):
    text=q['text']+'\n'+'\n'.join(q['options'])+'\n'+q.get('nativeSearchText','')
    def replace(m):
        path=str(ROOT/'public'/m[1].lstrip('/'))
        return OCR.get(path,{}).get('text','')
    return re.sub(r'!\[[^\]]*\]\((/question-assets/[^)]+)\)',replace,text)

def finalize():
    if (TMP/'ocr.jsonl').exists():
        for line in (TMP/'ocr.jsonl').read_text().splitlines():
            row=json.loads(line); OCR[row['path']]=row
    docs=json.loads((TMP/'extracted.json').read_text())
    if not OCR or not any(row.get('text','').strip() for row in OCR.values()):
        raise RuntimeError('OCR produced no searchable text. Check engine errors and rerun outside a restricted sandbox before finalizing.')
    errors=[row for row in OCR.values() if row.get('error')]
    if errors: raise RuntimeError(f'OCR failed for {len(errors)} assets; repair these before finalizing.')
    papers=[]; report=[]
    for idx,doc in enumerate(docs):
        sections=defaultdict(list); review=[]
        for q in doc['questions']:
            q['chapter'],q['topic']=classify(q)
            q['searchText']=search_text(q)
            # Raster content always stays visible; OCR is an aid for searching.
            q['extractionStatus']='review' if q['imageAssets'] else 'extracted'
            if q['correctIndex'] is None: q['extractionStatus']='review'
            if q['extractionStatus']=='review': review.append(q['qNo'])
            section=q.pop('section'); q.pop('imageAssets'); q.pop('passage'); q.pop('nativeSearchText',None)
            sections[section].append(q)
        f=doc['sourceFile']; tgt=f.startswith('tgt'); year=2022 if '22_s2' in f else 2021
        title=f'TGT Computer Science - Paper {idx+1}' if tgt else 'PGT Computer Science - '+('Female' if 'female' in f else 'Male')+f' ({year})'
        papers.append(dict(exam='DSSSB TGT' if tgt else 'DSSSB PGT',paperName=title,year=year,date=doc['date'],shift=f'Paper {idx+1}' if tgt else ('Female' if 'female' in f else 'Male') + (' - Shift 2' if year==2022 else ''),durationMin=120,totalMarks=len(doc['questions']),marking=dict(correct=1,negative=.25),sourceFile=f,sourceDurationMin=doc['sourceDurationMin'],dateKind=doc['dateKind'],sections=[dict(name=name,questions=qs) for name,qs in sections.items()]))
        report.append({k:v for k,v in doc.items() if k!='questions'} | dict(extractedQuestionCount=len(doc['questions']),missingAnswerCount=sum(q['correctIndex'] is None for q in doc['questions']),imageQuestionNumbers=review,sections={s:len(qs) for s,qs in sections.items()}))
    payload=dict(schemaVersion='1.0',papers=papers)
    (ROOT/'public/extracted-question-bank.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
    (ROOT/'public/extraction-report.json').write_text(json.dumps(dict(language='en',practiceDurationMin=120,classificationMethod='Keyword-assisted chapters and topics; inspect ambiguous classifications in the editor.',imagePolicy='Native PDF question and option images are retained without answer icons. OCR is search-only and may require review.',ocr=dict(processedAssets=len(OCR),nonemptyAssets=sum(bool(row.get('text','').strip()) for row in OCR.values()),errors=len(errors)),papers=report),indent=2))
    print('Bank:',sum(r['extractedQuestionCount'] for r in report),'questions;',sum(r['missingAnswerCount'] for r in report),'missing keys')

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--finalize',action='store_true'); args=parser.parse_args()
    TMP.mkdir(parents=True,exist_ok=True); ASSETS.mkdir(parents=True,exist_ok=True)
    if args.finalize: finalize()
    else:
        docs=[extract(f) for f in FILES]
        (TMP/'extracted.json').write_text(json.dumps(docs,ensure_ascii=False))
        (TMP/'ocr-manifest.json').write_text(json.dumps(sorted(ASSET_PATHS)))
        print('Image assets:',len(ASSET_PATHS))
