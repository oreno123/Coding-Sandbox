"""
本项目中用到的所有自定义异常。
"""

class EasierNJULibError(Exception):
    """自定义异常基类"""
    pass

class CrawlerError(EasierNJULibError):
    """爬虫相关异常"""
    pass

class NetworkError(CrawlerError):
    """网络相关异常"""
    pass

class ParseError(CrawlerError):
    """解析相关异常"""
    pass