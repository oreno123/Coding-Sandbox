import axios from 'axios'
const baseUrl = 'http://localhost:3001/persons'

const personService = {
  // 获取所有联系人
  getAll() {
    return axios.get(baseUrl).then(res => res.data)
  },
  // 添加新联系人
  create(newPerson) {
    return axios.post(baseUrl, newPerson).then(res => res.data)
  },
  // 删除联系人
  deletePerson(id) {
    return axios.delete(`${baseUrl}/${id}`).then(res => res.data)
  }
}

export default personService