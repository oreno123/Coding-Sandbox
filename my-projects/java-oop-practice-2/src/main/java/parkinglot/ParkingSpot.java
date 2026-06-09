package parkinglot;

public class ParkingSpot {
    private String spotId;
    private String type; // "小型", "中型", "大型"
    private boolean occupied;

    public ParkingSpot(String spotId, String type) {
        // TODO
        this.spotId = spotId;
        this.type = type;
        this.occupied = false;
    }

    public boolean park() {
        // TODO: 已占用返回 false，否则设为占用
        if (!occupied) {
            occupied = true;
            return true;
        }
        return false;
    }

    public boolean leave() {
        // TODO: 未占用返回 false，否则设为未占用
        if (occupied) {
            occupied = false;
            return true;
        }

        return false;
    }

    public String getSpotId() { return spotId; }
    public String getType() { return type; }
    public boolean isOccupied() { return occupied; }
}
