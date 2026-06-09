package parkinglot;

public class ParkingRecord {
    private String plateNumber;
    private String spotId;
    private long enterTime;
    private long exitTime;

    public ParkingRecord(String plateNumber, String spotId, long enterTime) {
        // TODO
        this.plateNumber = plateNumber;
        this.spotId = spotId;
        this.enterTime = enterTime;
        this.exitTime = -1;
    }

    public void setExitTime(long exitTime) {
        // TODO
        this.exitTime = exitTime;
    }

    public double calculateFee() {
        // 计费规则: 前30分钟免费，之后每小时5元，不足1小时按1小时算
        // 未设置 exitTime 返回 -1
        // TODO
        if(exitTime == -1) {
            return -1;
        }
        long time = exitTime - enterTime;
        if(time <= 90 * 30 * 1000L) {
            return 0;
        }else if((time-90 * 30 * 1000L) % (60*60*1000L) ==0) {
            return ((time-90 * 30 * 1000L) / (60*60*1000L)) * 5;
        }else{
            return ((time-90 * 30 * 1000L) / (60*60*1000L) + 1) * 5;
        }
    }

    public String getPlateNumber() { return plateNumber; }
    public String getSpotId() { return spotId; }
    public long getEnterTime() { return enterTime; }
    public long getExitTime() { return exitTime; }

    @Override
    public String toString() {
        // 格式: plateNumber @ spotId 费用:¥fee
        // TODO
        return plateNumber + " @ " + spotId + " 费用:¥" + calculateFee();
    }
}
