extends RigidBody2D

func _ready() -> void:
	$AnimatedSprite2D.animation = "walk_right"
	$AnimatedSprite2D.play() 

func _process(delta: float) -> void:
	pass
