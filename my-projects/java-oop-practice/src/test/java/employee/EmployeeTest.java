package employee;
import static org.junit.Assert.*;
import org.junit.Test;

public class EmployeeTest {

    @Test
    public void testFullTimeSalary() {
        FullTimeEmployee e = new FullTimeEmployee("Alice", "E001", 8000.0);
        assertEquals(8000.0, e.calculateSalary(), 0.01);
    }

    @Test
    public void testPartTimeSalary() {
        PartTimeEmployee e = new PartTimeEmployee("Bob", "E002", 20, 50.0);
        assertEquals(1000.0, e.calculateSalary(), 0.01);
    }

    @Test
    public void testToString() {
        Employee e = new FullTimeEmployee("Alice", "E001", 8000.0);
        assertEquals("E001 - Alice", e.toString());
    }

    @Test
    public void testStaticCounter() {
        int before = Employee.getTotalEmployees();
        new FullTimeEmployee("X", "T001", 3000);
        new PartTimeEmployee("Y", "T002", 10, 20);
        assertEquals(before + 2, Employee.getTotalEmployees());
    }

    @Test
    public void testCompanyTotalSalary() {
        Company company = new Company("TechCorp");
        company.addEmployee(new FullTimeEmployee("Alice", "E001", 8000.0));
        company.addEmployee(new PartTimeEmployee("Bob", "E002", 20, 50.0));
        assertEquals(9000.0, company.getTotalSalary(), 0.01);
    }

    @Test
    public void testCompanyFindHighestPaid() {
        Company company = new Company("TechCorp");
        FullTimeEmployee alice = new FullTimeEmployee("Alice", "E001", 8000.0);
        FullTimeEmployee bob = new FullTimeEmployee("Bob", "E002", 12000.0);
        company.addEmployee(alice);
        company.addEmployee(bob);
        assertEquals(bob, company.findHighestPaid());
    }

    @Test
    public void testCompanyEmpty() {
        Company company = new Company("Empty");
        assertEquals(0.0, company.getTotalSalary(), 0.01);
        assertNull(company.findHighestPaid());
    }

    @Test
    public void testCompanyNullIgnored() {
        Company company = new Company("TechCorp");
        company.addEmployee(null);
        assertEquals(0, company.getEmployeeCount());
    }
}
