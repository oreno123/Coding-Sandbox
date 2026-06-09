package employee;
import java.util.ArrayList;

class Company {
    private String companyName;
    private ArrayList<Employee> employees = new ArrayList<>();

    public Company(String companyName) {
        this.companyName = companyName;
    }

    public void addEmployee(Employee e) {
        // TODO: e 为 null 则忽略，否则加入 employees
        if(e != null){
            employees.add(e);   
        }
        return ;
    }

    public double getTotalSalary() {
        // TODO: 遍历所有员工，累加 calculateSalary()，空列表返回 0.0
        double sum = 0;
        for(Employee e : employees){
            sum += e.calculateSalary();
        }
        return sum;
    }

    public Employee findHighestPaid() {
        // TODO: 返回 calculateSalary() 最高的员工，空列表返回 null
        if(employees.size() > 0){
            Employee max = employees.get(0);
            for(Employee e : employees){
                if(e.calculateSalary() > max.calculateSalary()){
                    max = e;
                }
            }return max;
        }else{
            return null;
        }
    }

    public int getEmployeeCount() {
        return employees.size();
    }
}
