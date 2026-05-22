import memori
import sqlite3
from memori import Memori

# 1. 定义一个连接工厂函数（Memori要求必须是可调用的函数）
def get_sqlite_connection():
    return sqlite3.connect("memori.db")

# 2. 初始化Memori，传入conn参数（官方要求的参数名）
memori_instance = Memori(conn=get_sqlite_connection)
print("✅ memori 成功打开并初始化！")
print("📌 本地存储数据库：memori.db（项目根目录下）")

# 3. 测试：创建存储表
memori_instance.attribution(entity_id="test_user", process_id="test_session")
memori_instance.config.storage.build()
print("📝 测试上下文存储配置已完成，可正常使用存储/检索功能")