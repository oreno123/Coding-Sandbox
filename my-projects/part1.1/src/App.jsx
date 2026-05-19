import { useState, useEffect } from 'react'
import personService from './notes'
const Button = (props) => (
  <button 
    type={props.type || 'button'} 
    onClick={props.onClick}
    style={props.style} // 新增：接收样式属性
  >
    {props.text}
  </button>
)
const App = () => {
  const [persons, setPersons] = useState([])
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [findName, setFindName] = useState('')
  const [searchResult, setSearchResult] = useState('')
  // 存储通知内容，初始为 null（不显示）
const [notification, setNotification] = useState(null)
// 存储通知类型，默认 success
const [notificationType, setNotificationType] = useState('success')

  useEffect(() => {
    personService
      .getAll()
      .then(initialPersons => {
        setPersons(initialPersons) // 把后端数据存到状态里
      })
      .catch(err => console.error('加载联系人失败：', err))
  }, [])

  const showNotification = (message, type) => {
    setNotification(message)    // 设置通知内容
    setNotificationType(type)   // 设置通知类型
  }
  useEffect(() => {
    // 只有当 notification 有值时，才启动定时器
    if (notification) {
      // 原理：setTimeout 延迟3000ms（3秒）后，把 notification 设为 null（隐藏通知）
      const timer = setTimeout(() => {
        setNotification(null) // 清空通知，页面就不显示了
      }, 3000)

      // 原理：useEffect 的清理函数，防止组件卸载时定时器还在运行（内存泄漏）
      return () => clearTimeout(timer)
    }
  }, [notification]) // 依赖：只有 notification 变化时，才重新执行
  const handleNameChange = (event) => {setNewName(event.target.value)}
  const handleNumberChange = (event) => {setNewNumber(event.target.value)}
  const handleFindNameChange = (event) => {setFindName(event.target.value)}
  const setNewPerson = (event) => {
    event.preventDefault()
    const isDuplicate = persons.some(p => p.name === newName)
    if (isDuplicate) {
      showNotification(`${newName} 已存在，不能重复添加！`, 'error')
      return
    }
    const personObject = {
      name: newName,
      number: newNumber,
    }
    personService
      .create(personObject)
      .then(returnedPerson => {
        setPersons([...persons, returnedPerson]) // 更新前端列表
        setNewName('') // 清空输入框
        setNewNumber('')
        showNotification(`成功添加联系人：${returnedPerson.name}`, 'success')
      })
      .catch(err => {
        console.error('添加联系人失败：', err)
        // 新增失败：显示错误通知（区分404和其他错误）
        const errorMsg = err.response?.status === 404 
          ? '后端接口不存在，添加失败！' 
          : '添加联系人失败，请检查网络或后端服务！'
        showNotification(errorMsg, 'error')
      })
  }
  const findExistingPerson = (event) => {
    event.preventDefault()
    const person = persons.find(p => p.name === findName)
    if (person) {
      setSearchResult(<div>{person.name} is from {person.number}</div>)
    } else {
      setSearchResult(<div>{findName} is not found</div>)
    }
    setFindName('') 
  }

  const deletePerson = (id, name) => {
    if (window.confirm(`确定删除 ${name} 吗？`)) {
      personService
        .deletePerson(id)
        .then(() => {
          setPersons(persons.filter(p => p.id !== id))
          // 删除成功：显示成功通知
          showNotification(`成功删除联系人：${name}`, 'success')
        })
        .catch(err => {
          console.error('删除联系人失败：', err)
          // 删除失败：显示错误通知
          const errorMsg = err.response?.status === 404 
            ? `联系人 ${name} 已被删除（后端无此数据）！` 
            : `删除 ${name} 失败，请重试！`
          showNotification(errorMsg, 'error')
        })
    }
  }

    const Notification = () => {
    if (!notification) return null // 没有通知时，不渲染
    
    // 原理：根据 notificationType 动态设置样式
    const notificationStyle = {
      padding: '10px 15px',
      margin: '10px 0',
      borderRadius: '4px',
      border: '1px solid',
      // 成功：绿色系，错误：红色系
      backgroundColor: notificationType === 'success' ? '#d4edda' : '#f8d7da',
      color: notificationType === 'success' ? '#155724' : '#721c24',
      borderColor: notificationType === 'success' ? '#c3e6cb' : '#f5c6cb'
    }

    return <div style={notificationStyle}>{notification}</div>
  }
  return (
    <div>
      <h2>Phonebook</h2>
      <Notification />
      <form onSubmit={setNewPerson}>
        <div>
          name: <input value={newName} onChange={handleNameChange } />
        </div>
        <div>
          number: <input value={newNumber} onChange={handleNumberChange} />
        </div>
        <div>
          <Button type="submit" text="add"></Button>
        </div>
      </form>
      <h3>联系人列表</h3>
      <ul>
        {persons.map(person => (
          <li key={person.id}>
            {person.name} {person.number}
            <Button 
              text="删除" 
              onClick={() => deletePerson(person.id, person.name)} 
              style={{ marginLeft: 8, color: 'red' }}
            />
          </li>
        ))}
      </ul>

        <form onSubmit={findExistingPerson}>
        <div>
          find name: <input value={findName} onChange={handleFindNameChange} />
          <Button type="submit" text="find"></Button>
        </div>
        </form>
        {searchResult && searchResult}
    </div>
  )
}
export default App