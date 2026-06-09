package library;
class EBook extends Item implements Borrowable {
    private int downloadCount = 0;

    public EBook(String title) {
        // TODO: 调用父类构造函数
        super(title);
        downloadCount = 0;
        isAvailable = true;
    }

    public int getDownloadCount() {
        return downloadCount;
    }

    @Override
    public String borrow() {
        if(isAvailable()){
            isAvailable = false;
            downloadCount++;
            return "Borrowed: " + title;
        }else{
            return "Not available!";
        }
        // TODO: 和 Book 的 borrow 逻辑一样，但额外 downloadCount++
    }

    @Override
    public String returnItem() {
        if(isAvailable()==false){
            isAvailable = true;
            return "Returned "+title;
        }else{
            return "Item is already available";
        }
        // TODO: 和 Book 一样，设 isAvailable 为 true，返回 "Returned: " + title
    }
}
