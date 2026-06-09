package library;
abstract class Item {
    protected String title;
    protected boolean isAvailable = true;

    public Item(String title) {
        this.title = title;
    }

    public String getTitle() {
        return title;
    }

    public boolean isAvailable() {
        return isAvailable;
    }
}
