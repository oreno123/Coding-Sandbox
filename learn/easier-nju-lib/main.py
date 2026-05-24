"""
Easier NJU Lib 项目的 Streamlit Web 应用主入口。

在项目目录下执行指令 streamlit run main.py 即可运行。

本入口负责：
- 渲染前端 UI；
- 读取用户输入；
- 调用 crawler.service 中的服务完成搜索、排序；
- 清晰展示搜索结果。
"""
import streamlit as st
from config.settings import INSTRUCTION, NAMES_TO_CAMPUSES, STATUS_DISPLAY
from crawler.service import NJULibService

st.html("<title>Easier NJU Lib</title>")
st.header('Easier NJU Lib')
st.subheader('更好用的 NJU 图书馆检索方式')
with st.expander(':material/help: 这是什么'):
    st.write(INSTRUCTION)
campuses: list = NAMES_TO_CAMPUSES.keys()
name_selected = st.segmented_control(
    ":material/apartment: 校区", campuses, selection_mode="single"
)
if name_selected:
    campus_selected = NAMES_TO_CAMPUSES[name_selected]
else:
    campus_selected = None
max_num_of_results = st.slider(":material/vertical_align_top: 最大源数据条数", 10, 50, 15)
if max_num_of_results > 30:
    st.warning(':material/more_time: 条数过大可能导致搜索较慢。')
col1, col2, col3 = st.columns(3)
keyword = col1.text_input(':material/book_3: 书名').strip()
author = col2.text_input(':material/person: 作者（可选）').strip()
press = col3.text_input(':material/house: 出版社（可选）').strip()
if st.button(":material/search: 搜索"):
    #st.write(f'{campus_selected} hello, {keyword}')
    if keyword:
        with st.spinner('正在搜索……', show_time = True):
            books = NJULibService().search(keyword, max_num_of_results)

            # 若用户选择/输入了校区/作者/出版社，则优先显示更符合要求的结果。
            if name_selected:
                books = NJULibService().sort_by_campus(books, campus_selected)
            if author:
                books.sort_by_author(author)
            if press:
                books.sort_by_press(press)
        if len(books.list) == 0:
            st.warning(':material/close: 未搜索到任何结果。')
        elif campus_selected and not books.in_campus(campus_selected):
            st.warning(':material/sentiment_dissatisfied: 在所选校区未搜索到相关书目。请参考其他校区的结果或尝试增加 **最大源数据条数** 。')
            st.snow()
        else:
            st.success(':material/done_all: 搜索完成！')
            st.balloons()
        for book in books.list:
            with st.container(border=True):
                st.title(f':material/book: {book.title}')
                brief_message: str = f''

                # 若用户输入了作者，则将相符的作者用紫色突出显示，否则用灰色。
                if author and author in book.author:
                    brief_message += f':violet-badge[:material/person: {book.author}]'
                else:
                    brief_message += f':grey-badge[:material/person: {book.author}]'

                # 若用户输入了出版社，则将相符的出版信息用紫色突出显示，否则用灰色。
                if press and press in book.publication_info:
                    brief_message += f':violet-badge[:material/house: {book.publication_info}]'
                else:
                    brief_message += f':grey-badge[:material/house: {book.publication_info}]'

                brief_message += f':grey-badge[:material/barcode: {book.isbn}]'
                st.markdown(brief_message)
                if len(book.collection.list) == 0:
                    st.warning(':material/indeterminate_question_box: 这本书没有馆藏信息。')
                for record in book.collection.list:
                    record.sort_copies()
                    with st.container(border=True, gap = None):

                        # 若用户选择了校区，则将所选校区中的馆藏位置用紫色突出显示，否则用灰色。
                        if campus_selected and record.campus == campus_selected:
                            st.markdown(f':violet-badge[:material/location_on: {record.location}]')
                        else:
                            st.markdown(f':grey-badge[:material/location_on: {record.location}]')
                        for copy in record.copies:
                            message: str = f""

                            # 使用 status 文本在 settings STATUS_DISPLAY 中指定的图标和颜色。
                            # 若未指定，以普通文本形式显示。
                            if copy.borrow_status in STATUS_DISPLAY.keys():
                                message += f"{STATUS_DISPLAY[copy.borrow_status]}"
                            else:
                                message += f"{copy.borrow_status}"
                            if copy.book_status in STATUS_DISPLAY.keys():
                                message += f"{STATUS_DISPLAY[copy.book_status]}"
                            else:
                                message += f"{copy.book_status}"

                            if copy.edition:
                                message += f':grey-badge[:material/tag: {copy.edition}]'
                            if copy.call_num:
                                message += f' `{copy.call_num}` '
                            if copy.code_num:
                                message += f' `{copy.code_num}` '

                            st.markdown(message)
    else:
        st.warning(':material/keyboard_alt: 请输入书名。')
st.divider()
st.write(' `Made by JHY · NJU` ')