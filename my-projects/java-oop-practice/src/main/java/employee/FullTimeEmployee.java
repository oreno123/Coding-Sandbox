package employee;
class FullTimeEmployee extends Employee {
    private double monthlySalary;

    public FullTimeEmployee(String name, String id, double monthlySalary) {
        super(name, id);
        this.monthlySalary = monthlySalary;
    }

    @Override
    public double calculateSalary() {
        // TODO: return monthlySalary
        
        return monthlySalary;
    }
}
