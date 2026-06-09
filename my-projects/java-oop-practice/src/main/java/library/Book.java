package library;
class Book extends Item implements Borrowable {

    public Book(String title) {
        // TODO: 调用父类构造函数
        super(title);
    }

    @Override
    public String borrow() {
        if(isAvailable()){
            isAvailable = false;
            return "Borrowed: " + title;
        }else{
            return "Not available!";
        }
        // TODO: 如果 isAvailable，设为 false，返回 "Borrowed: " + title
        //       否则返回 "Not available!"
    }

    @Override
    public String returnItem() {
        if(isAvailable()==false){
            isAvailable = true;
            return "Returned: "+title;
        }else{
            return "Item is already available";
        }
        // TODO: 设 isAvailable 为 true，返回 "Returned: " + title
    }
}
