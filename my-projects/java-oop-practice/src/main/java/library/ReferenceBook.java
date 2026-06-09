package library;
class ReferenceBook extends Item {

    public ReferenceBook(String title) {
        super(title);
        
        // TODO: 调用父类构造函数
    }

    // 注意：参考书不可借，不实现 Borrowable 接口
}
