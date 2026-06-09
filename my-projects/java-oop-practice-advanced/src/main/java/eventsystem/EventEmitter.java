package eventsystem;

import java.util.ArrayList;
import java.util.List;

/**
 * 泛型事件发射器（观察者模式）。
 *
 * 考点：泛型 + 接口 + 观察者模式 + List 操作 + Lambda 兼容
 */
public class EventEmitter<T> {
    // TODO: 两个列表字段
    private List<EventListener<T>> listeners;
    private List<Event<T>> history;


    public EventEmitter() {
        this.listeners = new ArrayList<>();
        this.history = new ArrayList<>();
    }

    // TODO 1: 订阅监听器
    // 不允许重复添加同一个监听器对象（用 == 判断身份，不是 equals）
    //     // 即: 遍历 listeners，如果某个 listener == 新 listener，就不添加
    public void subscribe(EventListener<T> listener) {
        for (EventListener<T> existingListener : listeners) {
            if (existingListener == listener) {
                return;
            }
        }
        listeners.add(listener);
    }

    // TODO 2: 取消订阅
    // 遍历 listeners，移除 == listener 的那个
    // 注意：遍历时删除要用 Iterator.remove() 或从后往前遍历
    public void unsubscribe(EventListener<T> listener)
     {
        for (int i = listeners.size() - 1; i >= 0; i--) {
            if (listeners.get(i) == listener) {
                listeners.remove(i);
            }
        }
    }

    // TODO 3: 发射事件
    // 1) 记录到 history
    // 2) 遍历 listeners，对每个调用 listener.onEvent(event)
    public void emit(Event<T> event) {
        history.add(event);
        for (EventListener<T> listener : listeners) {
            listener.onEvent(event);
        }

    }

    // TODO 4: 便捷方法 — 创建事件并发射
    // 内部调用 emit(new Event<>(type, data))
    public void emit(String type, T data) {
        emit(new Event<>(type, data));
    }

    // TODO 5: 返回监听器数量
    public int getListenerCount() {
        return listeners.size();
    }

    // TODO 6: 返回历史事件数量
    public int getEventCount() {
        return history.size();
    }

    // TODO 7: 返回指定类型的历史事件列表
    // 遍历 history，筛选 event.getType().equals(type) 的事件
    public List<Event<T>> getEventsByType(String type) {
        List<Event<T>> filteredEvents = new ArrayList<>();
        for (Event<T> event : history) {
            if (event.getType().equals(type)) {
                filteredEvents.add(event);
            }
        }
        return filteredEvents;
    }

    // TODO 8: 清除所有监听器和历史记录
    public void clear() {
        listeners.clear();
        history.clear();
    }
}

