"""Refresh the reviewed starter catalogue; gameplay never calls these providers."""
import concurrent.futures, html, json, os, pathlib, re, time, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/guess-who'
OUT.mkdir(exist_ok=True)
HEADERS = {'User-Agent': 'TriviaWorld/1.0 (Guess Who card import; https://www.triviaworld.live)'}

def fetch(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
                return response.read()
        except Exception:
            if attempt == 3: raise
            time.sleep(2 ** attempt)

def api(base, params):
    return json.loads(fetch(base + '?' + urllib.parse.urlencode({**params, 'format': 'json'})))

animals = [('Dog','1f415'),('Cat','1f408'),('Mouse','1f401'),('Hamster','1f439'),('Rabbit','1f407'),('Fox','1f98a'),('Bear','1f43b'),('Panda','1f43c'),('Koala','1f428'),('Tiger','1f405'),('Lion','1f981'),('Cow','1f404'),('Pig','1f416'),('Frog','1f438'),('Monkey','1f412'),('Chicken','1f414'),('Penguin','1f427'),('Owl','1f989'),('Duck','1f986'),('Eagle','1f985'),('Bat','1f987'),('Wolf','1f43a'),('Horse','1f40e'),('Unicorn','1f984'),('Bee','1f41d'),('Butterfly','1f98b'),('Snail','1f40c'),('Ladybug','1f41e'),('Ant','1f41c'),('Spider','1f577'),('Scorpion','1f982'),('Turtle','1f422'),('Snake','1f40d'),('Lizard','1f98e'),('Octopus','1f419'),('Squid','1f991'),('Dolphin','1f42c'),('Whale','1f40b'),('Shark','1f988'),('Crocodile','1f40a'),('Elephant','1f418'),('Giraffe','1f992'),('Zebra','1f993'),('Gorilla','1f98d'),('Rhinoceros','1f98f'),('Hippopotamus','1f99b'),('Kangaroo','1f998'),('Camel','1f42a'),('Deer','1f98c'),('Hedgehog','1f994'),('Squirrel','1f43f'),('Otter','1f9a6'),('Peacock','1f99a'),('Flamingo','1f9a9'),('Parrot','1f99c'),('Crab','1f980'),('Lobster','1f99e'),('Shrimp','1f990'),('Goat','1f410'),('Sheep','1f411')]
# Real animals only, one recognizable concept per card.
animals = [item for item in animals if item[0] != 'Unicorn']
foods = [('Apple','1f34e'),('Pear','1f350'),('Orange','1f34a'),('Lemon','1f34b'),('Banana','1f34c'),('Watermelon','1f349'),('Grapes','1f347'),('Strawberry','1f353'),('Blueberries','1fad0'),('Cherries','1f352'),('Peach','1f351'),('Mango','1f96d'),('Pineapple','1f34d'),('Coconut','1f965'),('Kiwi','1f95d'),('Avocado','1f951'),('Tomato','1f345'),('Eggplant','1f346'),('Potato','1f954'),('Carrot','1f955'),('Corn','1f33d'),('Hot pepper','1f336'),('Broccoli','1f966'),('Garlic','1f9c4'),('Onion','1f9c5'),('Mushroom','1f344'),('Peanuts','1f95c'),('Bread','1f35e'),('Croissant','1f950'),('Pretzel','1f968'),('Bagel','1f96f'),('Pancakes','1f95e'),('Waffle','1f9c7'),('Cheese','1f9c0'),('Hamburger','1f354'),('French fries','1f35f'),('Pizza','1f355'),('Hot dog','1f32d'),('Taco','1f32e'),('Burrito','1f32f'),('Popcorn','1f37f'),('Egg','1f95a'),('Salad','1f957'),('Spaghetti','1f35d'),('Sushi','1f363'),('Dumpling','1f95f'),('Ice cream','1f368'),('Doughnut','1f369'),('Cookie','1f36a'),('Birthday cake','1f382'),('Cupcake','1f9c1'),('Chocolate','1f36b'),('Candy','1f36c'),('Lollipop','1f36d'),('Honey','1f36f'),('Milk','1f95b'),('Coffee','2615'),('Tea','1f375')]
TWEMOJI = 'https://raw.githubusercontent.com/jdecked/twemoji/v16.0.1/'
records = []
def emoji(item):
    category, name, code = item
    slug = name.lower().replace(' ', '-')
    filename = f'{category}-{slug}.svg'
    source = f'{TWEMOJI}assets/svg/{code}.svg'
    if not (OUT / filename).exists(): (OUT / filename).write_bytes(fetch(source))
    return {'id': f'{category}-{slug}', 'category': category, 'name': name, 'image': f'/guess-who/{filename}', 'source': source, 'author': 'Twemoji / Twitter contributors', 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/'}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records.extend(pool.map(emoji, [('animals', *x) for x in animals] + [('foods', *x) for x in foods]))
(OUT / 'TWEMOJI-LICENSE.txt').write_bytes(fetch(TWEMOJI + 'LICENSE-GRAPHICS'))

names = ['Taylor Swift','Beyoncé','Rihanna','Adele','Ed Sheeran','Billie Eilish','Ariana Grande','Drake (musician)','Eminem','Kendrick Lamar','Bruno Mars','Harry Styles','Shakira','Lady Gaga','Dua Lipa','Justin Bieber','Selena Gomez','Miley Cyrus','Michael Jackson','Elvis Presley','Dwayne Johnson','Leonardo DiCaprio','Tom Cruise','Brad Pitt','Angelina Jolie','Jennifer Aniston','Emma Watson','Daniel Radcliffe','Robert Downey Jr.','Chris Hemsworth','Scarlett Johansson','Zendaya','Will Smith','Keanu Reeves','Johnny Depp','Tom Hanks','Morgan Freeman','Ryan Reynolds','Ryan Gosling','Margot Robbie','Jennifer Lawrence','Anne Hathaway','Jackie Chan','Shah Rukh Khan','Cristiano Ronaldo','Lionel Messi','Serena Williams','LeBron James','Michael Jordan','Usain Bolt','Simone Biles','Roger Federer','David Beckham','Oprah Winfrey','Gordon Ramsay','MrBeast','Snoop Dogg','Dolly Parton','Jack Black','Samuel L. Jackson']
entities = []
for offset in range(0, len(names), 20):
    data = api('https://www.wikidata.org/w/api.php', {'action':'wbgetentities','sites':'enwiki','titles':'|'.join(names[offset:offset+20]),'props':'labels|claims|sitelinks','sitefilter':'enwiki','languages':'en','redirects':'yes'})
    if 'entities' not in data: raise RuntimeError(str(data))
    entities.extend(data['entities'].values())
filenames = {}
for entity in entities:
    claims = entity.get('claims', {}).get('P18', [])
    for claim in claims:
        filename = claim.get('mainsnak', {}).get('datavalue', {}).get('value')
        if filename:
            filenames.setdefault(filename, entity)
            break
metadata = {}
for offset in range(0, len(filenames), 10):
    subset = list(filenames)[offset:offset+10]
    data = api('https://commons.wikimedia.org/w/api.php', {'action':'query','titles':'|'.join('File:'+x for x in subset),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':320})
    for page in data['query']['pages'].values():
        if page.get('imageinfo'): metadata[page['title'][5:]] = page['imageinfo'][0]
    time.sleep(.3)

def portrait(item):
    filename, entity = item
    info = metadata.get(filename.replace('_', ' ')) or metadata.get(filename)
    if not info: return None
    ext = info.get('extmetadata', {})
    license_name = ext.get('LicenseShortName', {}).get('value', '')
    if not any(x in license_name.lower() for x in ['cc by', 'cc-by', 'cc0', 'public domain']): return None
    name = entity.get('labels', {}).get('en', {}).get('value') or entity.get('sitelinks', {}).get('enwiki', {}).get('title')
    if not name: return None
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    artist = html.unescape(re.sub('<[^>]+>', '', ext.get('Artist', {}).get('value', ''))).strip()
    thumb = info.get('thumburl')
    if not thumb: return None
    try:
        if os.environ.get('GUESS_REFRESH_IMAGES') == '1' or (not (OUT / f'celebrities-{slug}.source').exists() and not (OUT / f'celebrities-{slug}.webp').exists()): (OUT / f'celebrities-{slug}.source').write_bytes(fetch(thumb))
    except Exception as error: print('Skipped portrait:', name, str(error), flush=True); return None
    return {'id': f'celebrities-{entity["id"]}', 'category':'celebrities','name':name,'image':f'/guess-who/celebrities-{slug}.webp','source':info['descriptionurl'],'author':artist,'license':license_name,'licenseUrl':ext.get('LicenseUrl',{}).get('value',''),'wikidata':entity['id'],'modifications':'Resized and cropped to a square card thumbnail.'}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    records.extend(x for x in pool.map(portrait, filenames.items()) if x)
for category in ['animals','foods','celebrities']:
    count = sum(x['category'] == category for x in records)
    print(category, count, flush=True)
    if count < 40: raise RuntimeError('Not enough approved cards for varied boards: ' + category)
(ROOT / 'src/lib/guess-who/catalogue.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print('Run: bun scripts/optimize-guess-who.ts', flush=True)
