"""
本项目中会使用到的各种有意义的基础信息。
"""

BASE_URL = 'http://weixin.libstar.cn'

SEARCH_API = '/weixin/unify/search'

CAMPUSES_TO_NAMES = {'gulou': '鼓楼', 'xianlin': '仙林', 'pukou': '浦口', 'suzhou': '苏州'}

NAMES_TO_CAMPUSES = {'鼓楼': 'gulou', '仙林': 'xianlin', '浦口': 'pukou', '苏州': 'suzhou'}

STATUS_DISPLAY = {
    '可借': ':green-badge[:material/check: 可借]',
    '在架': ':green-badge[:material/newsstand: 在架]',
    '借出': ':orange-badge[:material/block: 借出]',
    '委托借出': ':orange-badge[:material/block: 委托借出]',
    '阅览': ':blue-badge[:material/import_contacts: 阅览]',
    '上委托书架': ':yellow-badge[:material/shelves: 上委托书架]',
    '签收': ':green-badge[:material/inventory: 签收]',
    '下架': ':red-badge[:material/do_not_disturb_on: 下架]',
    '装订中': ':blue-badge[:material/attach_file: 装订中]',
    '交接': ':blue-badge[:material/transform: 交接]'
}

INSTRUCTION = ("这是一个小应用，希望帮你更方便地查找NJU图书馆的藏书。  "
               "除了书名之外，你还可以指定 **校区、作者和出版社** ，  "
               "符合你需要的信息将被 **优先** 并 :violet-badge[突出] 展示。")