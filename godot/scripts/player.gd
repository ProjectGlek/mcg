extends CharacterBody2D

signal hit

@export var speed = 400
var screen_size
var sprite
var idle : float = 0

func _ready() -> void:
	screen_size = get_viewport_rect().size
	sprite = get_node("AnimatedSprite2D")

func _process(delta: float) -> void:
	velocity = Vector2.ZERO
	if Input.is_action_pressed("move_right"):
		velocity.x += 1
	if Input.is_action_pressed("move_left"):
		velocity.x -= 1
	if Input.is_action_pressed("move_down"):
		velocity.y += 1
	if Input.is_action_pressed("move_up"):
		velocity.y -= 1
		
	if velocity.length() > 0:
		velocity = velocity.normalized() * speed
		sprite.play()
		sprite.animation = "walk"
		sprite.flip_h = velocity.x < 0
		idle = 0
		#velocity += velocity * delta
		position = position.clamp(Vector2.ZERO, screen_size)
		move_and_slide()
		
	if velocity.x == 0 && velocity.y == 0:
		idle += delta
		
	if idle >= 5: 
		sprite.play()
		sprite.animation = "idle"
	elif velocity.length() == 0:
		sprite.stop();



func _on_body_entered(body: Node2D) -> void:
	hit.emit()
	get_node("CollisionShape2D").set_deferred("disabled", true)
