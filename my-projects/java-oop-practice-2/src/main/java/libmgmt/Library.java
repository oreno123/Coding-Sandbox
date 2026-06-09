package libmgmt;

import java.util.ArrayList;

public class Library {
    private ArrayList<Book> books = new ArrayList<>();

    public void addBook(Book book) {
        // TODO: isbn 重复则忽略
        for( Book book1 : books){
            if(book1.getIsbn().equals(book.getIsbn())){
                return;
            }
        }
        books.add(book);
    }

    public boolean removeBook(String isbn) {
        // TODO: 按 isbn 移除，返回是否成功
        for (Book book : books) {
            if (book.getIsbn().equals(isbn)) {
                books.remove(book);
                return true;
            }
        }
        return false;
    }

    public Book findBook(String isbn) {
        // TODO: 找不到返回 null
        for (Book book : books) {
            if (book.getIsbn().equals(isbn)) {
                return book;
            }
        }
        return null;
    }

    public ArrayList<Book> listByAuthor(String author) {
        // TODO: 按作者筛选
        ArrayList<Book> result = new ArrayList<>();
        for(Book book : books){
            if(book.getAuthor().equals(author)){
                result.add(book);
            }
        }
        return result;
    }

    public ArrayList<Book> listAvailable() {
        // TODO: 列出所有未借出的书
        ArrayList<Book> result = new ArrayList<>();
        for(Book book : books){
            if(!book.isBorrowed()){
                result.add(book);
            }
        }
        return result;
    }

    public boolean borrowBook(String isbn) {
        // TODO: 找不到或已借出返回 false
        Book book = findBook(isbn);
        if (book == null) {
            return false;
        }
        try {
            book.borrow();
            return true;
        } catch (IllegalStateException e) {
            return false;
        }
    }

    public boolean returnBook(String isbn) {
        // TODO: 找不到或未借出返回 false
        Book book = findBook(isbn);
        if (book == null) {
            return false;
        }
        try {
            book.returnBook();
            return true;
        } catch (IllegalStateException e) {
            return false;
        }
    }
}
