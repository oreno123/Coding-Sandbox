package contact;
import java.util.ArrayList;

class ContactBook {
    private ArrayList<Contact> contacts = new ArrayList<>();

    public boolean addContact(Contact c) {
        if (c == null)
            return false;
        if (contacts.contains(c))
            return false;
        contacts.add(c);
        return true;
        // TODO: c 为 null 返回 false
        //       contacts 已包含 c（用 contains，底层靠 equals 按手机号判重）返回 false
        //       否则添加并返回 true
    }

    public Contact searchByName(String keyword) {
        // TODO: 遍历 contacts，找到第一个 name 包含 keyword（忽略大小写）的 Contact
        //       找不到返回 null
        // 提示: getName().toLowerCase().contains(keyword.toLowerCase())
        for(Contact c:contacts){
            if(c.getName().toLowerCase().contains(keyword.toLowerCase())){
                return c;
            }
        }
        return null;
    }

    public boolean removeByPhone(String phone) {
        // TODO: 遍历 contacts，找到 phone 匹配的元素并删除，返回 true
        //       找不到返回 false
        for(Contact c:contacts){
            if(c.getPhone().equals(phone)){
                contacts.remove(c);
                return true;
            }
        }
        return false;
    }

    public int getSize() {
        return contacts.size();
    }
}
