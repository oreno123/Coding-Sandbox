const Note = ({ note, toggleImportance }) => {

  const label = note.important ? '取消重要' : '标为重要'
  
  return (
    <li>
      {note.content}
      <button onClick={toggleImportance} style={{ marginLeft: 8 }}>
        {label}
      </button>
    </li>
  )
}
export default Note