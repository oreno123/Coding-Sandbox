package contact;
class Contact {
    private String name;
    private String phone;

    public Contact(String name, String phone) {
        this.name = name;
        this.phone = phone;
    }

    public String getName() {
        return name;
    }

    public String getPhone() {
        return phone;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (obj == null || getClass() != obj.getClass())
            return false;
        Contact other = (Contact) obj;
        return this.phone.equals(other.phone);
        // TODO: 重写 equals，两个 Contact 的 phone 相同即为相等
        // 步骤：this == obj → true
        //       obj == null || getClass() != obj.getClass() → false
        //       比较 phone: return this.phone.equals(((Contact) obj).phone)
    }

    @Override
    public String toString() {
        // TODO: 返回 "[name] ([phone])"
        String str = name + " (" + phone + ")";
        return str;
    }
}
