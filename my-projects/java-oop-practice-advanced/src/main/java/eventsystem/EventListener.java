package eventsystem;

/**
 * 事件监听器接口（函数式接口，可用 Lambda 实现）。
 *
 * @param <T> 监听的事件数据类型
 */
public interface EventListener<T> {
    void onEvent(Event<T> event);
}
