"""
crawler.service

封装上层代码直接使用的功能。
"""

from crawler.models import Collection, Book, BookList, Record
from crawler.parser import NJULibParser
from crawler.client import NJULibClient
class NJULibService:
    """
    表示抽象的图书馆服务概念。
    """
    def search(self, keyword: str, num: int) -> BookList:
        """
        根据关键词搜索图书信息，限制最大条数。

        :param keyword: 用户输入的搜索关键词
        :param num: 最大源数据条数，指原网页上的图书条数
        :return: 包含搜索结果的 BookList 对象
        """
        brief_html: str = NJULibClient().search(keyword, rows=num)
        brief_book_list: BookList = NJULibParser().brief_parser(brief_html)
        detailed_book_list: BookList = BookList()
        for book in brief_book_list.list:
            detail_html = NJULibClient().fetch_book_detail(book.detail_url)
            book.collection = NJULibParser().detail_parser(detail_html)
            detailed_book_list.add_book(book, merge = True)
        return detailed_book_list

    def sort_by_campus(self, book_list: BookList, campus: str) -> BookList:
        """
        按校区排序 BookList 对象中的 Book 对象，
        以及 Book 对象中的 Record 对象。
        亦即 将相应校区的记录移动到列表开头。

        :param book_list: 待排序的 BookList 对象
        :param campus: 期望首先显示的记录所在的校区
        :return: 排序后的 BookList 对象
        """

        # 倒序遍历 Book 对象以保持原有顺序，以保证相关性降序。
        for book in book_list.list[::-1]:
            if book.in_campus(campus):
                book_list.list.remove(book)

                # 当且仅当 Book 对象包含相应校区的馆藏记录时，再将其中的记录按照校区排序。
                for record in book.collection.list:
                    if record.in_campus(campus):
                        book.collection.list.remove(record)
                        book.collection.list.insert(0, record)

                book_list.list.insert(0, book)
        return book_list