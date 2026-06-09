package course;
import java.util.ArrayList;

public class Course {
    private String courseName;
    private int maxCapacity;
    private ArrayList<Student> students = new ArrayList<>();

    public Course(String courseName, int maxCapacity) {
        this.courseName = courseName;
        this.maxCapacity = maxCapacity;
    }

    public boolean addStudent(Student s) {
        if (s == null || students.size() >= maxCapacity) {
            return false;
        }        
        students.add(s);
        return true;
        // TODO: null 返回 false；满了返回 false；否则添加并返回 true
    }

    public void printRoster() {
        // TODO: 遍历 students，调用每个学生的 displayInfo()
        for(Student s: students){
            s.displayInfo();
        }
    }

    public String getCourseName() {
        return courseName;
    }

    public int getStudentCount() {
        return students.size();
    }
}
