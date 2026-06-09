package eventsystem;

import static org.junit.Assert.*;
import org.junit.Test;

import java.util.List;

public class EventSystemTest {

    @Test
    public void testBasicEvent() {
        Event<String> e = new Event<>("click", "button1");
        assertEquals("click", e.getType());
        assertEquals("button1", e.getData());
        assertTrue(e.getTimestamp() > 0);
    }

    @Test
    public void testSubscribeAndEmit() {
        EventEmitter<String> emitter = new EventEmitter<>();
        StringBuilder sb = new StringBuilder();

        // 用匿名内部类实现 EventListener
        emitter.subscribe(new EventListener<String>() {
            @Override
            public void onEvent(Event<String> event) {
                sb.append(event.getData());
            }
        });

        emitter.emit("click", "A");
        assertEquals("A", sb.toString());
    }

    @Test
    public void testMultipleListeners() {
        EventEmitter<Integer> emitter = new EventEmitter<>();
        int[] sum = {0};

        // 用 Lambda 实现（EventListener 是函数式接口）
        emitter.subscribe(event -> sum[0] += event.getData());
        emitter.subscribe(event -> sum[0] += event.getData() * 10);

        emitter.emit("update", 5);
        // 5 + 50 = 55
        assertEquals(55, sum[0]);
    }

    @Test
    public void testUnsubscribe() {
        EventEmitter<String> emitter = new EventEmitter<>();
        StringBuilder sb = new StringBuilder();

        EventListener<String> listener = event -> sb.append(event.getData());
        emitter.subscribe(listener);
        assertEquals(1, emitter.getListenerCount());

        emitter.emit("test", "1");
        assertEquals("1", sb.toString());

        emitter.unsubscribe(listener);
        assertEquals(0, emitter.getListenerCount());

        emitter.emit("test", "2");
        assertEquals("1", sb.toString()); // 取消订阅后不再收到事件
    }

    @Test
    public void testNoDuplicateSubscribe() {
        EventEmitter<String> emitter = new EventEmitter<>();
        EventListener<String> listener = event -> {};

        emitter.subscribe(listener);
        emitter.subscribe(listener);
        emitter.subscribe(listener);
        assertEquals(1, emitter.getListenerCount());
    }

    @Test
    public void testEventHistory() {
        EventEmitter<String> emitter = new EventEmitter<>();
        emitter.subscribe(event -> {}); // 占位监听器

        emitter.emit("click", "A");
        emitter.emit("hover", "B");
        emitter.emit("click", "C");

        assertEquals(3, emitter.getEventCount());

        List<Event<String>> clicks = emitter.getEventsByType("click");
        assertEquals(2, clicks.size());
        assertEquals("A", clicks.get(0).getData());
        assertEquals("C", clicks.get(1).getData());

        List<Event<String>> hovers = emitter.getEventsByType("hover");
        assertEquals(1, hovers.size());
        assertEquals("B", hovers.get(0).getData());
    }

    @Test
    public void testGetEventsByTypeEmpty() {
        EventEmitter<String> emitter = new EventEmitter<>();
        emitter.subscribe(event -> {});
        emitter.emit("click", "A");

        List<Event<String>> results = emitter.getEventsByType("scroll");
        assertNotNull(results);
        assertEquals(0, results.size());
    }

    @Test
    public void testClear() {
        EventEmitter<Double> emitter = new EventEmitter<>();
        emitter.subscribe(event -> {});
        emitter.subscribe(event -> {});
        emitter.emit("price", 9.99);

        emitter.clear();
        assertEquals(0, emitter.getListenerCount());
        assertEquals(0, emitter.getEventCount());
    }

    @Test
    public void testEmitEventObject() {
        EventEmitter<Integer> emitter = new EventEmitter<>();
        int[] received = {-1};

        emitter.subscribe(event -> received[0] = event.getData());

        Event<Integer> evt = new Event<>("custom", 42);
        emitter.emit(evt);
        assertEquals(42, received[0]);
        assertEquals(1, emitter.getEventCount());
    }

    @Test
    public void testGenericTypes() {
        EventEmitter<Integer> intEmitter = new EventEmitter<>();
        EventEmitter<String> strEmitter = new EventEmitter<>();

        int[] counter = {0};
        intEmitter.subscribe(event -> counter[0] += event.getData());
        intEmitter.emit("inc", 42);
        assertEquals(42, counter[0]);

        StringBuilder sb = new StringBuilder();
        strEmitter.subscribe(event -> sb.append(event.getData()));
        strEmitter.emit("msg", "hello");
        assertEquals("hello", sb.toString());
    }
}
