package grade;

enum Grade {
    A(4.0), B(3.0), C(2.0), D(1.0), F(0.0);

    private final double point;

    Grade(double point) {
        this.point = point;
    }

    public double getPoint() {
        return point;
    }

    // TODO: 根据分数返回 Grade
    //       >= 90 返回 A, >= 80 返回 B, >= 70 返回 C, >= 60 返回 D, < 60 返回 F
    public static Grade fromScore(double score) {
        switch ((int) score / 10) {
            case 9:
            case 10:
                return Grade.A;
            case 8:
                return Grade.B;
            case 7:
                return Grade.C;
            case 6:
                return Grade.D;
            default:
                return Grade.F;
        }
    }
}
