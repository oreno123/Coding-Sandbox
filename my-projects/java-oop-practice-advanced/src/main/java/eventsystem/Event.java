package eventsystem;

/**
 * 泛型事件包装器。
 *
 * @param <T> 事件携带的数据类型
 */
public class Event<T> {
    private String type;
    private T data;
    private long timestamp;

    public Event(String type, T data) {
        this.type = type;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    public String getType() {
        return type;
    }

    public T getData() {
        return data;
    }

    public long getTimestamp() {
        return timestamp;
    }
}
