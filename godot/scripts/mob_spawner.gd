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
	pass 

func spawn_mob() -> void :
	var instace := Enemy.instantiate()
	
