package employee;
abstract class Employee {
    protected String name;
    protected String id;
    private static int totalEmployees = 0;

    public Employee(String name, String id) {
        this.name = name;
        this.id = id;
        // TODO: totalEmployees++
        totalEmployees++;
    }

    public abstract double calculateSalary();

    public static int getTotalEmployees() {
        // TODO: return totalEmployees;
        return totalEmployees;
    }

    @Override
    public String toString() {
        // TODO: 返回 "[id] - [name]"
        String str = String.format("%s - %s", id, name);
        return str;
    }
}
