const Button = (props) => (
  <button type={props.type || 'button'} onClick={props.onClick}>
    {props.text}
  </button>
)
export default Button