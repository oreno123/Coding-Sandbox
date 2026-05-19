import { useState, useEffect } from 'react'
import axios from 'axios'
import Note from './components/Note'
import Button from './components/Button'
import noteService from './notes'
const App = () => {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [showAll, setShowAll] = useState(true)


  useEffect(() => {
    // noteService.getAll() 直接返回数据（已封装 res.data）
    noteService
      .getAll()
      .then(initialNotes => { // 这里直接拿到便签数组，不用 response.data
        setNotes(initialNotes)
      })
      .catch(error => { // 加错误处理，方便调试
        console.error('加载便签失败：', error)
      })
  }, []) 

  const addNote = (event) => {
    event.preventDefault()
    const noteObject = {
      content: newNote,
      important: Math.random() > 0.5
    }

    noteService
      .create(noteObject)
      .then(returnedNote => { // 直接拿到后端返回的新便签
        setNotes(notes.concat(returnedNote)) // 更新前端列表
        setNewNote('') // 清空输入框
      })
      .catch(error => {
        console.error('添加便签失败：', error)
      })
  }
const toggleImportanceOf = (id) => {
    // 找到要修改的便签
    const note = notes.find(n => n.id === id)
    // 复制并修改重要性（不直接改原对象，React 状态不可变）
    const changedNote = { ...note, important: !note.important }

    // 调用 noteService 更新后端数据
    noteService
      .update(id, changedNote)
      .then(updatedNote => { // 直接拿到更新后的便签
        // 替换列表中对应 ID 的便签
        setNotes(notes.map(n => n.id === id ? updatedNote : n))
      })
      .catch(error => {
        console.error('更新便签失败：', error)
        alert('该便签已被删除，无法更新')
        setNotes(notes.filter(n => n.id !== id))
      })
  }

  const handleNoteChange = (event) => {
    console.log(event.target.value)
    setNewNote(event.target.value)
  }
  const notesToShow = showAll
    ? notes
    : notes.filter(note => note.important === true)

  return (
    <div>
      <h1>Notes</h1>
      <ul>
        {notesToShow.map(note => <Note key={note.id} note={note} toggleImportance={() => toggleImportanceOf(note.id)}/>)}
      </ul>
      <div>
        <button onClick={() => setShowAll(!showAll)}>
          show {showAll ? 'important' : 'all' }
        </button>
        
      </div>
      <form onSubmit={addNote}>
        <input value={newNote} onChange={handleNoteChange}/>
        <Button type="submit" text="save"/>
      </form>
    </div>
  )
}
//export default App
