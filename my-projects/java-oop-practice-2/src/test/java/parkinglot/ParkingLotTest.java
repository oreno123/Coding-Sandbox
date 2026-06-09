package parkinglot;

import org.junit.Test;
import static org.junit.Assert.*;

public class ParkingLotTest {

    private ParkingLot createLot() {
        ParkingLot lot = new ParkingLot();
        lot.addSpot(new ParkingSpot("A01", "小型"));
        lot.addSpot(new ParkingSpot("A02", "小型"));
        lot.addSpot(new ParkingSpot("B01", "中型"));
        return lot;
    }

    @Test
    public void testEnter() {
        ParkingLot lot = createLot();
        ParkingRecord r = lot.enter("苏A12345", "小型");
        assertNotNull(r);
        assertEquals("苏A12345", r.getPlateNumber());
        assertEquals("A01", r.getSpotId());
        assertEquals(1, lot.getAvailableCount("小型"));
    }

    @Test
    public void testEnterNoMatchingType() {
        ParkingLot lot = createLot();
        assertNull(lot.enter("苏A12345", "大型")); // 没有大型车位
    }

    @Test
    public void testEnterAllOccupied() {
        ParkingLot lot = createLot();
        lot.enter("苏A11111", "小型");
        lot.enter("苏A22222", "小型");
        assertNull(lot.enter("苏A33333", "小型")); // 小型车位全满
        assertEquals(0, lot.getAvailableCount("小型"));
    }

    @Test
    public void testExit() {
        ParkingLot lot = createLot();
        lot.enter("苏A12345", "小型");
        assertEquals(1, lot.getAvailableCount("小型"));

        // 模拟停了90分钟
        double fee = lot.exit("苏A12345");
        assertEquals(2, lot.getAvailableCount("小型")); // 释放了
    }

    @Test
    public void testExitNotExist() {
        ParkingLot lot = createLot();
        assertEquals(-1, lot.exit("苏Z99999"), 0.01);
    }

    @Test
    public void testCalculateFeeFree() {
        // 停29分钟 → 免费
        ParkingRecord r = new ParkingRecord("苏A12345", "A01", 0);
        r.setExitTime(29 * 60 * 1000L);
        assertEquals(0, r.calculateFee(), 0.01);
    }

    @Test
    public void testCalculateFeeOneHour() {
        // 停90分钟 → 前30分钟免费，剩60分钟=1小时 → 5元
        ParkingRecord r = new ParkingRecord("苏A12345", "A01", 0);
        r.setExitTime(90 * 60 * 1000L);
        assertEquals(5, r.calculateFee(), 0.01);
    }

    @Test
    public void testCalculateFeePartial() {
        // 停75分钟 → 前30分钟免费，剩45分钟 → 不足1小时按1小时 → 5元
        ParkingRecord r = new ParkingRecord("苏A12345", "A01", 0);
        r.setExitTime(75 * 60 * 1000L);
        assertEquals(5, r.calculateFee(), 0.01);
    }

    @Test
    public void testCalculateFeeMultipleHours() {
        // 停150分钟 → 前30分钟免费，剩120分钟=2小时 → 10元
        ParkingRecord r = new ParkingRecord("苏A12345", "A01", 0);
        r.setExitTime(150 * 60 * 1000L);
        assertEquals(10, r.calculateFee(), 0.01);
    }

    @Test
    public void testCalculateFeeNoExit() {
        ParkingRecord r = new ParkingRecord("苏A12345", "A01", 0);
        assertEquals(-1, r.calculateFee(), 0.01);
    }

    @Test
    public void testSpotParkLeave() {
        ParkingSpot spot = new ParkingSpot("A01", "小型");
        assertFalse(spot.isOccupied());
        assertTrue(spot.park());
        assertTrue(spot.isOccupied());
        assertFalse(spot.park()); // 已占用
        assertTrue(spot.leave());
        assertFalse(spot.isOccupied());
        assertFalse(spot.leave()); // 未占用
    }
}
