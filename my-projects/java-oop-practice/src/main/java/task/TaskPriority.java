package task;

enum TaskPriority {
    LOW(1), MEDIUM(2), HIGH(3), URGENT(4);

    private final int level;

    TaskPriority(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }
}
