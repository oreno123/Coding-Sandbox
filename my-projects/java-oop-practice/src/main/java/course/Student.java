package course;
public class Student {
    private String name;
    private String studentId;
    private double gpa;

    public Student(String name, String studentId, double gpa) {
        this.name = name;
        this.studentId = studentId;
        this.gpa = gpa;
    }

    public void setGpa(double gpa) {
        if(gpa < 0.0 || gpa > 4.0) {
            System.out.println("Invalid GPA. Please enter a value between 0.0 and 4.0.");
        } else {
            this.gpa = gpa;
        }
        // TODO: 校验 [0.0, 4.0]，不合法打印 "Invalid GPA. Please enter a value between 0.0 and 4.0."
    }

    public String getName() {
        return name;
    }
    public String getStudentId() {
        return studentId;
    }
    public double getGpa() {
        return gpa;
    }
    // TODO: 补充 getName() getter
    // TODO: 补充 getStudentId() getter
    // TODO: 补充 getGpa() getter

    public void displayInfo() {
        // TODO: 格式 "Student: [name], ID: [studentId], GPA: [gpa]"
        System.out.println("Student: " + name + ", ID: " + studentId + ", GPA: " + gpa);
    }
}
