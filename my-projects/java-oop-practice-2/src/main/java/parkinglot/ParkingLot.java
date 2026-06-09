package parkinglot;

import java.util.ArrayList;
import java.util.HashMap;

public class ParkingLot {
    private ArrayList<ParkingSpot> spots = new ArrayList<>();
    private ArrayList<ParkingRecord> records = new ArrayList<>();
    private HashMap<String, ParkingRecord> activeRecords = new HashMap<>(); // key: 车牌号

    public void addSpot(ParkingSpot spot) {
        // TODO
        spots.add(spot);
    }

    public ParkingRecord enter(String plateNumber, String type) {
        // TODO: 找第一个类型匹配的空车位，没有返回 null
        // 成功则创建 ParkingRecord 并放入 activeRecords
        for (ParkingSpot spot : spots) {
            if (spot.getType().equals(type)) {
                if (spot.park()) {
                    ParkingRecord record = new ParkingRecord(plateNumber, spot.getSpotId(), System.currentTimeMillis());
                    activeRecords.put(plateNumber, record);
                    records.add(record);
                    return record;
                }
            }
        }
        return null;
    }

    public double exit(String plateNumber) {
        ParkingRecord record = activeRecords.get(plateNumber);
        if (record == null) {
            return -1;
        }
        
        record.setExitTime(System.currentTimeMillis());
        // 释放车位
        for (ParkingSpot spot : spots) {
            if (spot.getSpotId().equals(record.getSpotId())) {
                spot.leave();
            }
        }
            activeRecords.remove(plateNumber);
        
        // TODO: 车牌不存在返回 -1
        // 设置 exitTime(用 System.currentTimeMillis())，释放车位，从 activeRecords 移除，返回费用
        return record.calculateFee();
    }

    public int getAvailableCount(String type) {
        // TODO: 查询某类型剩余车位数
        int count = 0;
        for (ParkingSpot spot : spots) {
            if (spot.getType().equals(type)) {
                if (!spot.isOccupied()) {
                    count++;
                }
            }
        }
        return count;
    }

    public void printActiveVehicles() {
        // TODO: 打印所有在场车辆信息
        for (ParkingRecord record : activeRecords.values()) {
            System.out.println(record);
        }
    }
}
