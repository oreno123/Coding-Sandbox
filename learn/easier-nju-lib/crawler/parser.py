"""
crawler.parser

封装解析 html 功能。
"""

from bs4 import BeautifulSoup
from crawler.models import Collection, Book, BookList, Record
from exceptions import ParseError
class NJULibParser:
    """
    表示抽象的解析概念。
    注：以下解析函数均基于当前原网页结构，
    若原网页更新，需要相应调整解析规则。
    """
    def brief_parser(self, html: str) -> BookList:
        """
        解析搜索结果页 html 。

        :param html: 搜索结果页 html
        :return: 包含该页所有图书基本信息的 BookList 对象
        """
        soup = BeautifulSoup(html, 'lxml')

        # 在搜索结果页中，
        # 每个 <a href="..." class="weui-media-box weui-media-box_appmsg"> 表示一条图书结果。
        #  href 参数为该图书详情页的 url 。
        # 内部结构包括：
        # <h4 class="weui-media-box__title"> : 书名
        # 第 1 个 <p class="weui-media-box__desc"> : 作者
        # 第 2 个 <p class="weui-media-box__desc"> : ISBN
        # 第 3 个 <p class="weui-media-box__desc"> : 出版信息

        results = soup.find_all('a', class_='weui-media-box weui-media-box_appmsg')
        book_list: BookList = BookList()
        for result in results:

            detail_url = result['href']
            if detail_url is None:
                raise ParseError('detail url is not found')
            title_node = result.find('h4', class_='weui-media-box__title')
            desc_node = result.find_all('p', class_='weui-media-box__desc')
            if not (title_node and desc_node):
                raise ParseError('brief node is not found')
            if len(desc_node) < 3:
                raise ParseError('desc node is not complete')
            title = title_node.text.strip()
            author = desc_node[0].text.strip()[4:]
            isbn = desc_node[1].text.strip()[5:]
            publication_info = desc_node[2].text.strip()[5:]
            book = Book(title, author, isbn, publication_info, detail_url)
            book_list.add_book(book, merge = False)
        return book_list

    def detail_parser(self, html: str) -> Collection:

        """
        解析图书详情页 html 。

        :param html: 图书详情页 html
        :return: 整理好的馆藏信息
        """

        collection: Collection = Collection()
        detail_soup = BeautifulSoup(html, 'lxml')

        # 在图书详情页中，
        # 每个 <div class="loc_item"> 表示一条馆藏记录。
        # 内部结构包括：
        # <b> : 包含馆藏位置和借阅状态，由 1 个 ‘|’ 和若干个空格隔开
        # <span class="tag"> : 图书状态
        # <p class="loc_info"> : 包含索书号、编号和版本/分册/分期（不一定全有，但顺序固定），由 ‘|’ 隔开（竖线个数固定）
        loc_items = detail_soup.find_all('div', class_='loc_item')
        for loc_item in loc_items:

            loc_borrow_status_node = loc_item.find('b')
            book_status_node = loc_item.find('span', class_='tag')
            loc_info_node = loc_item.find('p', class_='loc_info')
            if not (loc_borrow_status_node and book_status_node and loc_info_node):
                raise ParseError('detail node is not found')

            loc_borrow_status_part = loc_borrow_status_node.text.split()
            if len(loc_borrow_status_part) < 3:
                raise ParseError('loc_borrow_status_part is not complete')

            loc_info_part = loc_info_node.text.replace(' ', '').split('|')
            if len(loc_info_part) < 3:
                raise ParseError('loc_info_part is not complete')


            location = loc_borrow_status_part[0].strip()

            # 有时原网页上的状态只含有 ‘-’ 或 ‘—’。
            # 这种情况下，我们当作空状态处理。
            # 下面的 edition 也是一样的处理，
            # 之所以使用 .strip() 而不是 .remove() ，
            # 是因为有时表达有效信息的 edition 中也含有 ‘-’。
            borrow_status = loc_borrow_status_part[2].strip().strip('—').strip('-')
            book_status = book_status_node.text.strip()
            call_num = loc_info_part[0].strip()
            code_num = loc_info_part[1].strip()
            edition = loc_info_part[2].strip().strip('-')
            new_record = Record(location)
            new_record.add_copy(borrow_status, book_status, call_num, code_num, edition)
            collection.add_record(new_record)
        return collection