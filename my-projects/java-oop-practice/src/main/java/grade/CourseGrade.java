package grade;

class CourseGrade {
    private String courseName;
    private double score;
    private int credits;

    public CourseGrade(String courseName, double score, int credits) {
        this.courseName = courseName;
        this.score = score;
        this.credits = credits;
    }

    public String getCourseName() {
        return courseName;
    }

    public double getScore() {
        return score;
    }

    public int getCredits() {
        return credits;
    }

    // TODO: 调用 Grade.fromScore(score) 获取等级
    public Grade getGrade() {
        return Grade.fromScore(score);
    }

    // TODO: 返回 Grade 绩点 * 学分，即 getGrade().getPoint() * credits
    public double getWeightedPoints() {
        return getGrade().getPoint() * credits;
    }

    // TODO: 返回 "[courseName]: [score取整] -> [grade] ([credits]学分)"
    //       如 "Java: 92 -> A (4学分)"
    //       提示: String.format("%s: %.0f -> %s (%d学分)", courseName, score, getGrade(), credits)
    @Override
    public String toString() {
        return String.format("%s: %.0f -> %s (%d学分)", courseName, score, getGrade(), credits);
    }
}
