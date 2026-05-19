const Courses = ({ courses }) => {
  return (
    <ul>{courses.map(course=>
    <li key={course.id}>
      {course.name}
      {course.parts.map(part=><li key={part.id}>{part.name} {part.exercises}</li>)} 
      total of exercises {course.parts.reduce((sum,part)=>sum+part.exercises,0)}
    </li>)}
    </ul>
  )
}

const App = () => {
  const courses = [{
    id: 1,
    name: 'Half Stack application development',
    parts: [
      {
        name: 'Fundamentals of React',
        exercises: 10,
        id: 1
      },
      {
        name: 'Using props to pass data',
        exercises: 7,
        id: 2
      },
      {
        name: 'State of a component',
        exercises: 14,
        id: 3
      }
    ]
  },
  {
      name: 'Node.js',
      id: 2,
      parts: [
        {
          name: 'Routing',
          exercises: 3,
          id: 1
        },
        {
          name: 'Middlewares',
          exercises: 7,
          id: 2
        }
      ]
    }
  ]


  return <Courses courses={courses} />
}

export default Courses