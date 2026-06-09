package libmgmt;

public class Book {
    private String title;
    private String author;
    private String isbn;
    private boolean isBorrowed;

    public Book(String title, String author, String isbn) {
        // TODO
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.isBorrowed = false;
    }

    public void borrow() {
        // TODO: 已借出则抛 IllegalStateException("该书已被借出")
        if (isBorrowed) {
            throw new IllegalStateException("该书已被借出");
        }
        isBorrowed = true;
    }

    public void returnBook() {
        // TODO: 未借出则抛 IllegalStateException("该书未被借出")
        if (!isBorrowed) {
            throw new IllegalStateException("该书未被借出");
        }
        isBorrowed = false;
    }

    public String getIsbn() {
        // TODO

        return this.isbn;
    }

    public String getAuthor() {
        // TODO
        return this.author;
    }

    public boolean isBorrowed() {
        // TODO
        return this.isBorrowed;
    }

    @Override
    public String toString() {
        // 格式: [isbn] title by author (借出) 或 (在馆)
        // TODO
        if (isBorrowed) {
            return "[" + this.isbn + "] " + this.title + " by " + this.author + " (借出)";
        } else {
            return "[" + this.isbn + "] " + this.title + " by " + this.author + " (在馆)";
        }
    }
}
