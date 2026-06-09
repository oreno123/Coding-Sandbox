package grade;

import java.util.ArrayList;
import java.util.List;

class StudentRecord {
    private String studentName;
    private String studentId;
    private List<CourseGrade> grades = new ArrayList<>();

    public StudentRecord(String studentName, String studentId) {
        this.studentName = studentName;
        this.studentId = studentId;
    }

    // TODO: 添加成绩，null 忽略
    public void addGrade(CourseGrade cg) {
        if(cg != null) {
            grades.add(cg);
        }
    }

    // TODO: 计算加权平均分
    //       加权平均 = sum(score * credits) / sum(credits)
    //       如果没有成绩，返回 0.0
    public double getAverageScore() {
        double sum = 0;
        int totalCredits = 0;
        for (CourseGrade cg : grades) {
            sum += cg.getScore() * cg.getCredits();
            totalCredits += cg.getCredits();
        }
        if(totalCredits != 0) {
            return sum / totalCredits;
        }
        return 0;
    }

    // TODO: 计算加权绩点 (GPA)
    //       GPA = sum(gradePoint * credits) / sum(credits)
    //       如果没有成绩，返回 0.0
    public double getGPA() {
        double sum = 0;
        int totalCredits = 0;
        for (CourseGrade cg : grades) {
            sum += cg.getGrade().getPoint() * cg.getCredits();
            totalCredits += cg.getCredits();
        }        if(totalCredits != 0) {
            return sum / totalCredits;
        }
        return 0;
    }

    // TODO: 返回所有不及格（F 等级）的课程名列表
    //       提示: 遍历 grades，如果 cg.getGrade() == Grade.F，加入结果列表
    public List<String> getFailedCourses() {
        List<String> failedCourses = new ArrayList<>();
        for (CourseGrade cg : grades) {
            if (cg.getGrade() == Grade.F) {
                failedCourses.add(cg.getCourseName());
            }
        }
        return failedCourses;
    }

    public String getStudentName() {
        return studentName;
    }

    public String getStudentId() {
        return studentId;
    }

    public List<CourseGrade> getGrades() {
        return new ArrayList<>(grades);
    }
}
