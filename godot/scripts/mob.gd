extends Area2D

var speed = 200
var target : Node2D

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	var direction = (target.position - position).normalized()
	position += direction * speed * delta
	
	
