# Java OOP 练习题 (第二弹)

面向对象期末备考练习，共 5 道题，覆盖多类协作、CRUD、状态机、泛型栈。

每题提供骨架代码（`// TODO`）+ JUnit 测试，目标：**让所有测试变绿**。

---

## 题目一：图书管理系统 `libmgmt`（2 个类）

**考察点：** ArrayList、equals 判重、异常抛出、toString 格式化

### Book
| 方法 | 行为 |
|------|------|
| `borrow()` | 设为借出；已借出抛 `IllegalStateException` |
| `returnBook()` | 设为在馆；未借出抛 `IllegalStateException` |
| `toString()` | `[isbn] title by author (借出/在馆)` |

### Library
| 方法 | 行为 |
|------|------|
| `addBook(Book)` | isbn 重复则忽略 |
| `removeBook(String)` | 按 isbn 移除，返回是否成功 |
| `findBook(String)` | 按 isbn 查找，找不到返回 null |
| `listByAuthor(String)` | 按作者筛选 |
| `listAvailable()` | 列出所有未借出的书 |
| `borrowBook(String)` | 找不到或已借出返回 false |
| `returnBook(String)` | 找不到或未借出返回 false |

---

## 题目二：学生选课系统 `courseselect`（3 个类）

**考察点：** HashMap、双向关联（Student ↔ Course）、容量控制

### Student
| 方法 | 行为 |
|------|------|
| `enroll(courseId)` | 已选返回 false |
| `drop(courseId)` | 未选返回 false |
| `toString()` | `studentId name (已选N门)` |

### Course
| 方法 | 行为 |
|------|------|
| `addStudent()` | 满员返回 false，否则 enrolled++ |
| `removeStudent()` | 无人返回 false，否则 enrolled-- |
| `isFull()` | enrolled == capacity |
| `toString()` | `courseId courseName (enrolled/capacity)` |

### CourseSystem
| 方法 | 行为 |
|------|------|
| `enroll(studentId, courseId)` | 四种失败：学生不存在/课程不存在/已选/满员 |
| `drop(studentId, courseId)` | 三种失败：学生不存在/课程不存在/未选 |
| `printStudentCourses(studentId)` | 遍历已选课程调用 toString |

---

## 题目三：简易订单系统 `ordersystem`（3 个类）

**考察点：** 库存联动、同商品累加、状态机（待支付→已支付→已发货→已完成）

### Product
| 方法 | 行为 |
|------|------|
| `reduceStock(qty)` | 库存不足返回 false |
| `addStock(qty)` | 加库存 |

### OrderItem
| 方法 | 行为 |
|------|------|
| `getSubtotal()` | price × quantity |
| `addQuantity(qty)` | 累加数量 |

### Order
| 方法 | 行为 |
|------|------|
| `addItem(product, qty)` | 扣库存；同商品累加 |
| `removeItem(productId)` | 移除并归还库存 |
| `getTotal()` | 累加所有 subtotal |
| `pay()` / `ship()` / `complete()` | 状态正向流转，非法返回 false |

---

## 题目四：停车位管理 `parkinglot`（3 个类）

**考察点：** 时间计算、HashMap 快查、车位类型匹配

### ParkingSpot
| 方法 | 行为 |
|------|------|
| `park()` | 占用，已占用返回 false |
| `leave()` | 释放，未占用返回 false |

### ParkingRecord
| 方法 | 行为 |
|------|------|
| `calculateFee()` | 前30分钟免费，之后每小时5元，不足1小时按1小时算；未设 exitTime 返回 -1 |

### ParkingLot
| 方法 | 行为 |
|------|------|
| `enter(plate, type)` | 找第一个类型匹配的空车位 |
| `exit(plate)` | 设 exitTime、释放车位、返回费用；车牌不存在返回 -1 |
| `getAvailableCount(type)` | 某类型剩余车位数 |

---

## 题目五：可变长栈 + 文本编辑器 `texteditor`（2 个类）

**考察点：** 泛型、数组手动扩容、双栈模型、StringBuilder

### ArrayStack<T>
用**数组**实现，禁止用 `java.util.Stack` 或 `ArrayList`。

| 方法 | 行为 |
|------|------|
| `push(item)` | 满时扩容为 2 倍（手写扩容，不用 Arrays.copyOf） |
| `pop()` | 栈空抛 `EmptyStackException` |
| `peek()` | 栈空抛 `EmptyStackException` |
| `capacity()` | 返回当前数组容量 |
| `clear()` | size 归零 |

### TextEditor
双栈模型：left 栈存光标左边字符，right 栈存光标右边字符。

| 方法 | 行为 |
|------|------|
| `insert(char)` | push 到 left |
| `insert(String)` | 逐字符 push 到 left |
| `delete()` | 从 left 弹出，空返回 `'\0'` |
| `deleteRight()` | 从 right 弹出，空返回 `'\0'` |
| `moveLeft()` / `moveRight()` | 左右栈互倒一个元素 |
| `moveStart()` | left 全部倒入 right |
| `moveEnd()` | right 全部倒入 left |
| `getText()` | left 从底到顶 + right 从顶到底 |
| `getCursorPosition()` | left.size() |

---

## 如何运行

```bash
cd java-oop-practice-2
mvn test
```

或在 IDEA 中打开项目，直接运行各 Test 文件。

**目标：5 个 Test 文件全部绿色通过。**
