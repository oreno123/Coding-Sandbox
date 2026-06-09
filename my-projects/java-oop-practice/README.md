# Java OOP 练习题

面向对象期末备考练习，共 3 道题，覆盖数组操作、继承体系、集合框架。

每题提供骨架代码 + JUnit 测试，目标：**让所有测试变绿**。

---

## 题目一：循环队列 (MyQueue)

**考察点：** 数组、取模运算、边界处理

实现一个固定容量的循环队列。构造函数传入容量，内部用数组 + `front`/`rear`/`count` 三个变量管理。

| 方法 | 行为 |
|------|------|
| `enqueue(int)` | 队满则忽略，否则加入 `rear` 位置，`rear = (rear+1) % length`，`count++` |
| `dequeue()` | 队空返回 `-1`，否则取 `front` 位置的值，`front = (front+1) % length`，`count--` |
| `peek()` | 队空返回 `-1`，否则返回 `front` 位置的值（不移除） |
| `isEmpty()` | `count == 0` |
| `isFull()` | `count == data.length` |
| `size()` | 返回 `count` |

**测试要点：** 基本入队出队、空队/满队处理、循环回绕（enqueue 超过数组长度后 rear 回到 0）。

---

## 题目二：图书馆系统 (LibrarySystem)

**考察点：** 继承、抽象类、接口

已有代码：

```
Item (abstract)         ← title, isAvailable
├── Book implements Borrowable       ← 可借/还
├── ReferenceBook                    ← 只能看，不可借
└── EBook implements Borrowable      ← 可借/还，额外统计下载次数

Borrowable (interface)  ← borrow(), returnItem()
```

你需要补全：

- **Book.borrow()** — 可用则设为不可用，返回 `"Borrowed: " + title`；否则返回 `"Not available!"`
- **Book.returnItem()** — 设为可用，返回 `"Returned: " + title`
- **EBook** — 同 Book 的借还逻辑，但 `borrow()` 时额外 `downloadCount++`
- **ReferenceBook** — 只需调用父类构造函数（不实现 Borrowable，测试里验证它没有 borrow 方法）
- **Item** — 已写好，不用改

**测试要点：** Book 借还状态切换、ReferenceBook 无 borrow 方法（编译期检查）、EBook 下载计数累加。

---

## 题目三：选课管理 (CourseManager)

**考察点：** ArrayList、HashMap、null 检查、封装

三个类：

### Student
| 方法 | 行为 |
|------|------|
| 构造函数 | 保存 name, studentId, gpa |
| `setGpa(double)` | 校验 `[0.0, 4.0]`，越界打印 `"Invalid GPA. Please enter a value between 0.0 and 4.0."` 且不修改 |
| `getGpa()` | getter |
| `getName()` | getter |
| `getStudentId()` | getter |
| `displayInfo()` | 打印 `"Student: [name], ID: [studentId], GPA: [gpa]"` |

### Course
| 方法 | 行为 |
|------|------|
| `addStudent(Student)` | null 返回 false；满员返回 false；否则添加并返回 true |
| `printRoster()` | 遍历调用每个学生的 `displayInfo()` |

### CourseManager
| 方法 | 行为 |
|------|------|
| `createCourse(String, int)` | 创建 Course 对象放入 Map |
| `enroll(String, Student)` | 从 Map 取 Course，取不到返回 false；能取到调用 `addStudent` |
| `findCourse(String)` | 找到则 `printRoster()`，找不到打印 `"Course [name] not found."` |

**测试要点：** GPA 越界拒绝、满员拒绝、null 拒绝、课程不存在时的提示信息。

---

## 如何运行测试

需要 JUnit 4。如果用 IDEA 直接跑 Test 文件即可。命令行：

```bash
# 假设 junit jar 在当前目录
javac -cp .:junit-4.13.2.jar:hamcrest-core-1.3.jar 01-MyQueue/*.java
java -cp .:junit-4.13.2.jar:hamcrest-core-1.3.jar org.junit.runner.JUnitCore MyQueueTest
```

**目标：3 个 Test 文件全部绿色通过。**

---

## 题目四：图形系统 (Shape)

**考察点：** 抽象类 + Comparable 接口 + toString 重写 + 多态

类层次：

```
Shape (abstract, implements Comparable<Shape>)
├── Circle    ← radius
└── Rectangle ← width, height
```

你需要补全：

- **Shape.toString()** — 用 `String.format("Shape: %s, Area: %.2f", name, getArea())` 返回格式化字符串
- **Shape.compareTo(Shape)** — 按面积升序比较，返回 `Double.compare(this.getArea(), other.getArea())`
- **Circle** — 保存 radius，实现 `getArea()`（πr²）和 `getPerimeter()`（2πr）
- **Rectangle** — 保存 width/height，实现 `getArea()`（w×h）和 `getPerimeter()`（2(w+h)）

**测试要点：** 面积/周长计算、toString 格式、`Arrays.sort()` 按 Comparable 排序、父类引用指向子类对象的多态调用。

---

## 题目五：员工薪资系统 (Employee)

**考察点：** 抽象类 + static 计数器 + 继承体系 + ArrayList 多态

类层次：

```
Employee (abstract)   ← name, id, static totalEmployees
├── FullTimeEmployee  ← monthlySalary
└── PartTimeEmployee  ← hoursWorked, hourlyRate

Company               ← ArrayList<Employee> 聚合
```

你需要补全：

- **Employee 构造函数** — `totalEmployees++`
- **Employee.getTotalEmployees()** — 返回静态计数器
- **Employee.toString()** — 返回 `"[id] - [name]"`
- **FullTimeEmployee.calculateSalary()** — 返回 monthlySalary
- **PartTimeEmployee.calculateSalary()** — 返回 hoursWorked × hourlyRate
- **Company.addEmployee()** — null 忽略，否则加入
- **Company.getTotalSalary()** — 遍历累加每个员工的 `calculateSalary()`
- **Company.findHighestPaid()** — 返回薪资最高的员工，空列表返回 null

**测试要点：** static 计数器跨实例累加、多态调用 calculateSalary、null 安全、空列表处理。

---

## 题目六：通讯录 (ContactBook)

**考察点：** equals 重写 + ArrayList.contains 判重 + 封装

两个类：

### Contact
| 方法 | 行为 |
|------|------|
| `equals(Object)` | phone 相同即相等（标准四步：this==obj → null/类型检查 → 强转 → 比较 phone） |
| `toString()` | 返回 `"[name] ([phone])"` |

### ContactBook
| 方法 | 行为 |
|------|------|
| `addContact(Contact)` | null 返回 false；已包含（contains 用 equals 判重）返回 false；否则添加返回 true |
| `searchByName(String)` | 遍历找第一个 name 包含关键字（忽略大小写）的联系人，找不到返回 null |
| `removeByPhone(String)` | 遍历找 phone 匹配的元素删除，返回是否成功 |
| `getSize()` | 返回联系人数量 |

**测试要点：** equals 重写让 `contains()` 按手机号判重、不同名字同手机号视为重复、搜索忽略大小写。

---

**目标：6 个 Test 文件全部绿色通过。**
