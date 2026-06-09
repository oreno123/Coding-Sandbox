package builder;

import java.util.ArrayList;
import java.util.List;

/**
 * 不可变 Student 对象 — 只能通过 Builder 创建，所有字段 final，无 setter。
 *
 * 考点：Builder 模式、方法链（fluent API）、不可变对象、参数校验、静态内部类
 */
public final class Student {
    private final String name;
    private final String id;
    private final int age;
    private final String major;
    private final double gpa;
    private final List<String> courses;

    // 私有构造函数，只允许 Builder 调用
    private Student(Builder builder) {
        this.name = builder.name;
        this.id = builder.id;
        this.age = builder.age;
        this.major = builder.major;
        this.gpa = builder.gpa;
        // 防御性拷贝，保证不可变性
        this.courses = builder.courses == null
                ? new ArrayList<>()
                : new ArrayList<>(builder.courses);
    }

    public String getName() { return name; }
    public String getId() { return id; }
    public int getAge() { return age; }
    public String getMajor() { return major; }
    public double getGpa() { return gpa; }
    // 返回副本，防止外部修改
    public List<String> getCourses() { return new ArrayList<>(courses); }

    // TODO: toString — 格式如下：
    //   "Student{id=S001, name=Alice, gpa=0.00, courses=[]}"
    //   如果 age != 0，在 name 后面加 ", age=20"
    //   如果 major != null，在 age 后面（或 name 后面）加 ", major=CS"
    //   gpa 始终保留2位小数
    //   courses 直接用 List 的 toString
    //
    // 示例:
    //   new Builder("Alice","S001").build()
    //     → "Student{id=S001, name=Alice, gpa=0.00, courses=[]}"
    //   new Builder("Bob","S002").age(21).major("CS").gpa(3.5).addCourse("OOP").build()
    //     → "Student{id=S002, name=Bob, age=21, major=CS, gpa=3.50, courses=[OOP]}"
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        if(this.age != 0) {
            sb.append("Student{id=").append(id).append(", name=").append(name).append(", age=").append(age);
        } else {
            sb.append("Student{id=").append(id).append(", name=").append(name);
        }
        if(major != null) {
            sb.append(", major=").append(major);
        }
        sb.append(", gpa=").append(String.format("%.2f", gpa)).append(", courses=").append(courses).append("}");
        return sb.toString();
    }

    /**
     * 静态 Builder 内部类 — 创建 Student 的唯一途径。
     */
    public static class Builder {
        // 必填字段
        private final String name;
        private final String id;

        // 可选字段（带默认值）
        private int age = 0;
        private String major = null;
        private double gpa = 0.0;
        private List<String> courses = new ArrayList<>();

        // TODO 1: 构造函数
        // name 为 null 或 trim 后为空 → IllegalArgumentException("Name is required")
        // id 为 null 或 trim 后为空 → IllegalArgumentException("ID is required")
        public Builder(String name, String id) {
            if(name == null || name.trim().isEmpty()) {
                throw new IllegalArgumentException("Name is required");
            }
            if(id == null || id.trim().isEmpty()) {
                throw new IllegalArgumentException("ID is required");
            }
            this.name = name;
            this.id = id;
        }

        // TODO 2: age — age < 0 抛 IllegalArgumentException("Age cannot be negative")
        //         返回 this 实现方法链
        public Builder age(int age) {
            if(age < 0) {
                throw new IllegalArgumentException("Age cannot be negative");
            }
            this.age = age;

            return this;
        }

        // TODO 3: major — 返回 this
        public Builder major(String major) {
            this.major = major;
            return this;
        }

        // TODO 4: gpa — gpa < 0 或 gpa > 4.0 抛 IllegalArgumentException("GPA must be between 0.0 and 4.0")
        //         返回 this
        public Builder gpa(double gpa) {
            if(gpa < 0 || gpa > 4.0) {
                throw new IllegalArgumentException("GPA must be between 0.0 and 4.0");
            }
            this.gpa = gpa;

            return this;
        }

        // TODO 5: addCourse — course == null 抛 IllegalArgumentException("Course cannot be null")
        //         否则加入 courses 列表，返回 this
        public Builder addCourse(String course) {
            if(course == null) {
                throw new IllegalArgumentException("Course cannot be null");
            }
            courses.add(course);
            return this;
        }

        // TODO 6: build — return new Student(this)
        public Student build() {
            return new Student(this);
        }
    }
}
