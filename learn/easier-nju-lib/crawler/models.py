"""
crawler.models

项目中涉及的各种 类。
"""
from config.settings import NAMES_TO_CAMPUSES
from typing import List, Dict

class Copy:
    """
    表示一册实体书的记录。
    包含借阅状态、图书状态、索书号、编号和版本/分册/分期等详细信息。
    """
    def __init__(self, borrow_status: str, book_status: str, call_num: str, code_num: str, edition: str):
        """
        初始化 Copy 对象。

        :param borrow_status: 借阅状态。例如 “可借”
        :param book_status: 图书状态。例如 “在架”
        :param call_num: 索书号
        :param code_num: 编号
        :param edition: 版本/分册/分期等
        """
        self.borrow_status: str = borrow_status
        self.book_status: str = book_status
        self.call_num: str = call_num
        self.code_num: str = code_num
        self.edition: str = edition

class Record:
    """
    表示一种书在一个馆藏位置下的馆藏记录（Record）。
    一个 Record 对应一个具体馆藏地点（location），
    包含该地点所在校区（campus）以及该地点下的若干实体书册（copies）。
    """
    def __init__(self, location: str):
        """
        初始化 Record 对象。
        :param location: 馆藏位置
        注：当一个 Record 被初始化时， campus 根据馆藏位置的第 5 ~ 6 个字符自动补充（如 “南京大学-鼓楼综合借阅室” -> ‘鼓楼’ -> ‘gulou’），
        若无法对应则置为 None 。
        copies 和 copy_num 在初始化阶段为空，后续添加和合并时维护。
        """
        self.location: str = location
        self.campus: str | None = None
        self.copies: List[Copy] = []
        self.copy_num: int = 0
        if location[5:7] in NAMES_TO_CAMPUSES.keys():
            self.campus = NAMES_TO_CAMPUSES[location[5:7]]

    def sort_copies(self) -> None:
        """
        对自身属性 copies 进行排序。
        依次按照 版本/分册/分期、编号、索书号 进行排序。
        :return: 直接修改自身属性 copies ，无返回值
        """
        self.copies.sort(key=lambda x: (x.edition, x.code_num, x.call_num))

    def add_copy(self, borrow_status: str, book_status: str, call_num: str, code_num: str, edition: str):
        """
        添加一册实体书的记录。
        :param borrow_status: 借阅状态。例如 “可借”
        :param book_status: 图书状态。例如 “在架”
        :param call_num: 索书号
        :param code_num: 编号
        :param edition: 版本/分册/分期等
        :return: 直接在自身属性上添加，无返回值
        """
        new_copy: Copy = Copy(borrow_status, book_status, call_num, code_num, edition)
        self.copies.append(new_copy)
        self.copy_num += 1

    def merge_copies(self, new_copies: List[Copy]):
        """
        添加多册实体书的记录。
        亦即 将 由 Copy 对象组成的列表合并到自身属性 Copies 中。
        :param new_copies: 新添加的实体书记录
        :return: 直接在自身属性上添加，无返回值
        """
        self.copies += new_copies
        self.copy_num += len(new_copies)
    def in_campus(self, campus: str) -> bool:
        """
        检测该馆藏记录是否在指定校区。
        :param campus: 指定校区
        :return: 代表是否在指定校区
        """
        if self.campus == campus:
            return True
        return False

class Collection:
    """
    表示一种书的馆藏信息（Collection）。
    一个 Collection 对应一种书（Book），
    包含若干馆藏记录（Record）。
    """
    def __init__(self):
        """
        初始化 Collection 对象。
        list 在初始化阶段为空，后续添加时维护。
        """
        self.list: List[Record] = []
    def add_record(self, new_record: Record) -> None:
        """
        添加一条馆藏记录（Record）。
        若新增的馆藏记录与已有的馆藏记录位置（location）相同，
        则将新增的馆藏记录的所有实体书记录（copy）合并到已有的馆藏记录中；
        否则直接添加。
        :param new_record:
        :return: 直接在自身属性上添加，无返回值
        """
        for record in self.list:
            if record.location == new_record.location:
                record.merge_copies(new_record.copies)
                return None
        self.list.append(new_record)
        return None


class Book:
    """
    表示一种书。
    包含书名、作者、ISBN、出版信息、馆藏信息（Collection）和图书详情页的 url 。
    注：
    本项目中，我们用 书名 和 ISBN 的组合来确定书的种类。
    也就是说，当且仅当两本书的 书名 和 ISBN 都相同时，我们将它们视为同一种书。
    """
    def __init__(self, title: str, author: str, isbn: str, publication_info: str, detail_url: str):
        """
        初始化 Book 对象。
        :param title: 书名
        :param author: 作者
        :param isbn: 书号
        :param publication_info: 出版信息，一般为 “<出版社> <出版年份>”
        :param detail_url: 图书详情页 url
        初始化时，属性 collection 为空，后续操作时维护。
        """
        self.title = title
        self.author = author
        formatted_isbn = isbn.strip().replace('-', '')
        if len(formatted_isbn) == 13:
            self.isbn = formatted_isbn
        elif '-' not in isbn:
            self.isbn = isbn
        elif len(formatted_isbn) == 10:
            self.isbn = '978' + formatted_isbn
        else:
            self.isbn = isbn
        self.publication_info = publication_info
        self.collection = Collection()
        self.detail_url = detail_url

    def add_collection(self, new_collection: Collection) -> None:
        """
        添加馆藏信息。
        :param new_collection: 要添加的馆藏信息
        :return: 直接在自身属性上添加，无返回值
        """
        self.collection.list += new_collection.list
    def in_campus(self, campus: str) -> bool:
        """
        检测该书是否在指定校区有馆藏。
        :param campus: 指定校区
        :return: 代表是否在指定校区有馆藏
        """
        for record in self.collection.list:
            if record.in_campus(campus):
                return True
        return False

class BookList:
    """
    表示书的列表。
    """
    def __init__(self):
        """
        初始化 BookList 对象。
        """
        self.list: List[Book] = []
    def add_book(self, new_book: Book, merge: bool) -> None:
        """
        添加一种书（Book）。
        若参数 merge 为 True，
        则当待添加的书与某本已有的书为同一种书时，
        将两本书合并，
        即 将两本书的馆藏信息（Collection）合并，
        仅保留列表中先存在的书（Book）的其他信息；
        否则直接加入，不尝试合并。
        :param new_book: 待添加的书
        :param merge: 是否合并
        :return: 直接在自身属性上添加，无返回值
        注：
        Q：为什么要设计 merge 参数？
        A：我们的图书检索分为两轮：
            1. 获取搜索结果；
            2. 获取每条搜索结果的详细信息。
        在两轮搜索中，我们都需要使用 BookList 类的 add_book 方法，但有一个细节不同。
        第 2 轮中我们希望合并搜索结果，因为我们希望将同一种书的所有馆藏信息放在一起展示；
        但第 1 轮中我们不希望合并搜索结果，因为即便多条搜索结果对应同一本书，
        我们也需要保留搜索结果各自的 图书详情页 url ，否则会丢失馆藏信息。
        """
        if merge:
            for book in self.list:
                if book.isbn == new_book.isbn and book.title == new_book.title:
                    book.add_collection(new_book.collection)
                    return None
        self.list.append(new_book)
        return None

    def in_campus(self, campus: str) -> bool:
        """
        检测 本 书列表（BookList） 中是否存在 在指定校区有馆藏的 书（Book）。
        :param campus: 指定校区
        :return: 代表是否在指定校区有馆藏
        """
        for book in self.list:
            if book.in_campus(campus):
                return True
        return False

    def sort_by_press(self, press: str):
        """
        将 本 书列表 中的 书 按照出版社顺序排序。
        即 将指定出版社出版的书调到列表开头，同时保持原有顺序。
        :param press: 指定出版社
        :return: 直接修改自身属性，无返回值
        """

        # 倒序遍历 Book 对象以保持原有顺序，以保证相关性降序。
        for book in self.list[::-1]:
            if press in book.publication_info:
                self.list.remove(book)
                self.list.insert(0, book)
        return self

    def sort_by_author(self, author: str):
        """
        将 本 书列表 中的 书 按照作者顺序排序。
        即 将指定作者的书调到列表开头，同时保持原有顺序。
        :param author: 指定作者
        :return: 直接修改自身属性，无返回值
        """

        # 倒序遍历 Book 对象以保持原有顺序，以保证相关性降序。
        for book in self.list[::-1]:
            if author in book.author:
                self.list.remove(book)
                self.list.insert(0, book)
        return self