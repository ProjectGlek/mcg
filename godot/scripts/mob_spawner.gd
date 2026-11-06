class_name MobSpawner
extends Timer

## Сцена врага
@export var Enemy : PackedScene
## Цель к которой летят враги
@export var Target : Node
## Максимальное количество мобов за тик
@export var MaxMobs : int
## Минимальная продолжительность одного тика в секундах
@export var MinTick : float
## Максимальная продолжительность одного тика в секундах
@export var MaxTick : float

func _ready() -> void:
	pass

func _process(delta: float) -> void:
	pass

func _on_timeout() -> void:
	spawn_mob() 

func spawn_mob() -> void :
	var instace := Enemy.instantiate()
	var radius := get_viewport().get_visible_rect().size.length() / 2# счетаим радиус от центра как пол идагонали устроства
	var randAngle := Vector2.from_angle(randf() * TAU)# рандомны угол тау это 2п радиан
	instace.position = get_viewport().get_visible_rect().size / 2 + randAngle * radius #и умнажаем единичный вектар по углу на радеус
	instace.target = get_node("../Player")
	add_child(instace)

	
