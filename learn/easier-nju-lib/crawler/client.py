"""
crawler.client

封装获取 html 功能。
"""

import requests
from config.settings import BASE_URL, SEARCH_API
from config.magic_params import MAGIC_PARAMS
from exceptions import NetworkError
class NJULibClient:
    """
    表示抽象的抓取网页原始数据的概念。
    """
    def search(self, keyword: str, page: int = 1, rows: int = 15) -> str:
        """
        在原网页上搜索关键词，
        限制页数和图书条数，
        抓取搜索结果页的整个网页备用。

        :param keyword: 用户输入的搜索关键词
        :param page: 请求中用于控制结果页数的参数。方便起见，本项目中始终设为 1
        :param rows: 请求中用于控制每页结果条数的参数。鉴于 page 始终为 1 ，该参数即最大源数据条数
        :return: 搜索结果页的整个网页 html
        """

        # 按照原网页的 url 组织参数
        params = {
            'mappingPath': MAGIC_PARAMS['mappingPath'],
            'groupCode': MAGIC_PARAMS['groupCode'],
            'pubId': MAGIC_PARAMS['pubId'],
            'searchFieldContent': keyword,
            'searchField': MAGIC_PARAMS['searchField'],
            'page': page,
            'rows': rows
        }
        response = requests.get(BASE_URL + SEARCH_API, params)
        if response.status_code != 200:
            raise NetworkError(f'HTTP {response.status_code}')
        response.encoding = 'utf-8'
        return response.text

    def fetch_book_detail(self, detail_url: str) -> str:
        """
        抓取图书详情页的整个网页备用。

        :param detail_url: 图书详情页地址
        :return: 图书详情页的整个网页 html
        """
        response = requests.get(BASE_URL + detail_url)
        if response.status_code != 200:
            raise NetworkError(f'HTTP {response.status_code}')
        response.encoding = 'utf-8'
        return response.text