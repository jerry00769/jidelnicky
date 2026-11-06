from html.parser import HTMLParser
from pathlib import Path
from datetime import date
import re,json,importlib.util,unicodedata,hashlib

class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 def text(self):return ''.join(c.text() if isinstance(c,Node) else c for c in self.children)
 def find(self,cls):
  result=[]
  if cls in self.attrs.get('class','').split():result.append(self)
  for c in self.children:
   if isinstance(c,Node):result.extend(c.find(cls))
  return result
class Tree(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  node=Node(tag,attrs);self.stack[-1].children.append(node)
  if tag not in {'input','img','br','hr','meta','link','area','base','embed','source','wbr','col','param'}:self.stack.append(node)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];return
 def handle_data(self,data):self.stack[-1].children.append(data)
def fold(s):return ''.join(c for c in unicodedata.normalize('NFD',s.casefold()) if not unicodedata.combining(c))
def parse_month(raw,month):
 data=json.loads(raw)
 if data.get('chyba') is not False or not isinstance(data.get('data'),str):raise ValueError('Source reports unavailable month')
 tree=Tree();tree.feed(data['data']);result=[];observed=[]
 for group in tree.root.find('objednavka-obalka'):
  title=group.find('objednavka-den-obalka')
  if not title:continue
  title=title[0].attrs.get('title','') or title[0].text().strip()
  match=re.search(r'(\d{1,2})\.\s*(\d{1,2})\.',title)
  if not match:raise ValueError('Missing date '+title)
  day,mon=map(int,match.groups())
  if mon!=int(month[4:]):raise ValueError('Unexpected month '+title)
  d=date(int(month[:4]),mon,day)
  weekday=fold(title.split()[0]);expected=['pondeli','utery','streda','ctvrtek','patek','sobota','nedele'][d.weekday()]
  if weekday!=expected:raise ValueError('Source weekday contradicts requested year: '+month+' '+title)
  observed.append(d.isoformat())
  for item in group.find('objednavka-jidlo-obalka'):
   labels=item.find('objednavka-jidlo-popis');names=item.find('objednavka-jidlo-nazev')
   if not labels or not names:continue
   label=labels[0].text().strip();name=names[0].text().strip()
   # The legacy renderer includes empty Oběd 2 form slots even when no second lunch was published.
   if not name or fold(name)==fold(label) or fold(name) in {'obed 1','obed 2','polevka'}:continue
   result.append({'datum':d.strftime('%d.%m.%Y'),'druh_popis':label,'nazev':name})
 return result,observed
